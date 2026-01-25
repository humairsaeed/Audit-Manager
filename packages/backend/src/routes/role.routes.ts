import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { ApiResponse, SYSTEM_ROLES } from '../types/index.js';

const router = Router();

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  level: z.number().min(0).max(100).default(50),
  permissionIds: z.array(z.string().uuid()).optional(),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  level: z.number().min(0).max(100).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/roles
 * @desc List all roles
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { level: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystemRole: role.isSystemRole,
        level: role.level,
        userCount: role._count.users,
        permissions: role.permissions.map((rp) => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          scope: rp.permission.scope,
          description: rp.permission.description,
        })),
      })),
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/roles/permissions
 * @desc List all available permissions
 */
router.get(
  '/permissions',
  asyncHandler(async (req: Request, res: Response) => {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    const response: ApiResponse = {
      success: true,
      data: permissions,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/roles/:id
 * @desc Get role by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw AppError.notFound('Role');
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...role,
        permissions: role.permissions.map((rp) => rp.permission),
      },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/roles
 * @desc Create a new role
 */
router.post(
  '/',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createRoleSchema.parse(req.body);

    // Check if role name already exists
    const existing = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw AppError.conflict('Role with this name already exists');
    }

    const role = await prisma.role.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        level: data.level,
        isSystemRole: false,
        permissions: data.permissionIds
          ? {
              create: data.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { role },
      message: 'Role created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route PUT /api/v1/roles/:id
 * @desc Update role
 */
router.put(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateRoleSchema.parse(req.body);

    const role = await prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw AppError.notFound('Role');
    }

    if (role.isSystemRole) {
      throw AppError.forbidden('Cannot modify system roles');
    }

    // Update permissions if provided
    if (data.permissionIds) {
      // Remove existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Add new permissions
      await prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        displayName: data.displayName,
        description: data.description,
        level: data.level,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { role: updatedRole },
      message: 'Role updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/roles/:id
 * @desc Delete role
 */
router.delete(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw AppError.notFound('Role');
    }

    if (role.isSystemRole) {
      throw AppError.forbidden('Cannot delete system roles');
    }

    if (role._count.users > 0) {
      throw AppError.badRequest('Cannot delete role that is assigned to users');
    }

    // Delete role permissions first
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // Delete role
    await prisma.role.delete({ where: { id } });

    const response: ApiResponse = {
      success: true,
      message: 'Role deleted successfully',
    };

    res.json(response);
  })
);

export default router;
