import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { ApiResponse, RESOURCES, ACTIONS, SYSTEM_ROLES } from '../types/index.js';

const router = Router();

// Validation schemas
const createEntitySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const updateEntitySchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/entities
 * @desc List all entities
 */
router.get(
  '/',
  requirePermission(RESOURCES.ENTITY, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const flat = req.query.flat === 'true';

    const where: { isActive?: boolean } = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const entities = await prisma.entity.findMany({
      where,
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: includeInactive ? {} : { isActive: true },
          select: { id: true, code: true, name: true },
        },
        _count: {
          select: { audits: true, observations: true },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    // Build hierarchy if not flat
    let result;
    if (flat) {
      result = entities;
    } else {
      const entityMap = new Map(entities.map((e) => [e.id, { ...e, children: [] as typeof entities }]));
      const roots: typeof entities = [];

      for (const entity of entities) {
        if (entity.parentId && entityMap.has(entity.parentId)) {
          entityMap.get(entity.parentId)!.children.push(entityMap.get(entity.id)!);
        } else if (!entity.parentId) {
          roots.push(entityMap.get(entity.id)!);
        }
      }
      result = roots;
    }

    const response: ApiResponse = {
      success: true,
      data: { entities: result },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/entities
 * @desc Create a new entity
 */
router.post(
  '/',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createEntitySchema.parse(req.body);

    // Check for duplicate code
    const existing = await prisma.entity.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw AppError.conflict('An entity with this code already exists');
    }

    // Calculate level
    let level = 0;
    if (data.parentId) {
      const parent = await prisma.entity.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        throw AppError.badRequest('Parent entity not found');
      }
      level = parent.level + 1;
    }

    const entity = await prisma.entity.create({
      data: {
        ...data,
        level,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { entity },
      message: 'Entity created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/entities/:id
 * @desc Get entity by ID
 */
router.get(
  '/:id',
  requirePermission(RESOURCES.ENTITY, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
        },
        _count: {
          select: { audits: true, observations: true },
        },
      },
    });

    if (!entity) {
      throw AppError.notFound('Entity');
    }

    const response: ApiResponse = {
      success: true,
      data: { entity },
    };

    res.json(response);
  })
);

/**
 * @route PUT /api/v1/entities/:id
 * @desc Update entity
 */
router.put(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateEntitySchema.parse(req.body);

    const entity = await prisma.entity.findUnique({ where: { id } });

    if (!entity) {
      throw AppError.notFound('Entity');
    }

    // Check for duplicate code if changing
    if (data.code && data.code !== entity.code) {
      const existing = await prisma.entity.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw AppError.conflict('An entity with this code already exists');
      }
    }

    // Calculate level if parent changed
    let level = entity.level;
    if (data.parentId !== undefined) {
      if (data.parentId === null) {
        level = 0;
      } else if (data.parentId !== entity.parentId) {
        const parent = await prisma.entity.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) {
          throw AppError.badRequest('Parent entity not found');
        }
        // Prevent circular reference
        if (parent.id === entity.id) {
          throw AppError.badRequest('Entity cannot be its own parent');
        }
        level = parent.level + 1;
      }
    }

    const updated = await prisma.entity.update({
      where: { id },
      data: {
        ...data,
        level,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { entity: updated },
      message: 'Entity updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/entities/:id
 * @desc Delete entity (deactivate)
 */
router.delete(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        _count: { select: { audits: true, observations: true, children: true } },
      },
    });

    if (!entity) {
      throw AppError.notFound('Entity');
    }

    // Check if entity has children
    if (entity._count.children > 0) {
      throw AppError.badRequest('Cannot delete entity with child entities');
    }

    // Check if entity has audits or observations
    if (entity._count.audits > 0 || entity._count.observations > 0) {
      // Deactivate instead of delete
      await prisma.entity.update({
        where: { id },
        data: { isActive: false },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Entity deactivated (has associated audits/observations)',
      };

      return res.json(response);
    }

    // Hard delete if no dependencies
    await prisma.entity.delete({ where: { id } });

    const response: ApiResponse = {
      success: true,
      message: 'Entity deleted successfully',
    };

    res.json(response);
  })
);

export default router;
