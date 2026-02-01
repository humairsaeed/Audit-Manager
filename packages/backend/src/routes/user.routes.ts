import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { UserService } from '../services/user.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse, SYSTEM_ROLES, RESOURCES, ACTIONS, CreateUserDTO } from '../types/index.js';
import { StorageService } from '../services/storage.service.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  roleIds: z.array(z.string().uuid()).min(1),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
});

const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
  entityId: z.string().uuid().optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/users
 * @desc List users with pagination
 */
router.get(
  '/',
  requirePermission(RESOURCES.USER, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const filters = {
      search: req.query.search as string,
      status: req.query.status as 'ACTIVE' | 'INACTIVE' | 'LOCKED' | undefined,
      roleId: req.query.roleId as string,
      department: req.query.department as string,
    };

    const result = await UserService.listUsers(
      { page, limit, sortBy, sortOrder },
      filters
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/users/search
 * @desc Search users for assignment dropdowns
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string || '';
    const limit = parseInt(req.query.limit as string) || 10;

    const users = await UserService.searchUsers(query, limit);

    const response: ApiResponse = {
      success: true,
      data: { users },
    };

    res.json(response);
  })
);

const ensureSelfOrAdmin = (authReq: AuthenticatedRequest, targetUserId: string) => {
  if (
    authReq.user.userId !== targetUserId &&
    !authReq.user.roles?.includes(SYSTEM_ROLES.SYSTEM_ADMIN)
  ) {
    throw new Error('FORBIDDEN');
  }
};

/**
 * @route GET /api/v1/users/:id/avatar
 * @desc Get user's avatar URL
 */
router.get(
  '/:id/avatar',
  requirePermission(RESOURCES.USER, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    try {
      ensureSelfOrAdmin(authReq, id);
    } catch {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.avatar) {
      return res.json({ success: true, data: { url: null } });
    }

    const url = await StorageService.getSignedUrl(user.avatar, 3600);
    const response: ApiResponse = {
      success: true,
      data: { url },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/avatar
 * @desc Upload user avatar
 */
router.post(
  '/:id/avatar',
  requirePermission(RESOURCES.USER, ACTIONS.UPDATE),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    try {
      ensureSelfOrAdmin(authReq, id);
    } catch {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    StorageService.validateFile(req.file);
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed for avatars',
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const filePath = await StorageService.uploadFile(req.file, `users/${id}/avatar`);

    const previousAvatar = user.avatar;
    const updated = await prisma.user.update({
      where: { id },
      data: { avatar: filePath },
    });

    if (previousAvatar && previousAvatar !== filePath) {
      await StorageService.deleteFile(previousAvatar).catch(() => undefined);
    }

    const url = await StorageService.getSignedUrl(updated.avatar as string, 3600);
    const response: ApiResponse = {
      success: true,
      data: { url },
      message: 'Avatar updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/users/:id/avatar
 * @desc Remove user avatar
 */
router.delete(
  '/:id/avatar',
  requirePermission(RESOURCES.USER, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    try {
      ensureSelfOrAdmin(authReq, id);
    } catch {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.avatar) {
      await StorageService.deleteFile(user.avatar).catch(() => undefined);
    }

    await prisma.user.update({
      where: { id },
      data: { avatar: null },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Avatar removed successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users
 * @desc Create a new user
 */
router.post(
  '/',
  requirePermission(RESOURCES.USER, ACTIONS.CREATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = createUserSchema.parse(req.body);
    const ipAddress = req.ip || null;

    const user = await UserService.createUser(data as CreateUserDTO, authReq.user.userId, ipAddress);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/users/:id
 * @desc Get user by ID
 */
router.get(
  '/:id',
  requirePermission(RESOURCES.USER, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await UserService.getUserById(id);

    const response: ApiResponse = {
      success: true,
      data: { user },
    };

    res.json(response);
  })
);

/**
 * @route PUT /api/v1/users/:id
 * @desc Update user
 */
router.put(
  '/:id',
  requirePermission(RESOURCES.USER, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const user = await UserService.updateUser(id, data);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/activate
 * @desc Activate user account
 */
router.post(
  '/:id/activate',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await UserService.activateUser(id);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User activated successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/deactivate
 * @desc Deactivate user account
 */
router.post(
  '/:id/deactivate',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await UserService.deactivateUser(id);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User deactivated successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/lock
 * @desc Lock user account
 */
router.post(
  '/:id/lock',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { durationMinutes = 60 } = req.body;

    const user = await UserService.lockUser(id, durationMinutes);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: `User locked for ${durationMinutes} minutes`,
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/unlock
 * @desc Unlock user account
 */
router.post(
  '/:id/unlock',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await UserService.unlockUser(id);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User unlocked successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/users/:id/roles
 * @desc Assign roles to user
 */
router.post(
  '/:id/roles',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { roleIds, entityId } = assignRolesSchema.parse(req.body);

    const user = await UserService.assignRoles(id, roleIds, authReq.user.userId, entityId);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'Roles assigned successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/users/:id/roles
 * @desc Remove roles from user
 */
router.delete(
  '/:id/roles',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { roleIds, entityId } = assignRolesSchema.parse(req.body);

    const user = await UserService.removeRoles(id, roleIds, entityId);

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'Roles removed successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user (soft delete)
 */
router.delete(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await UserService.deleteUser(id);

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
    };

    res.json(response);
  })
);

export default router;
