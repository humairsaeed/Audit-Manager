import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { StorageService } from '../services/storage.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate user and get tokens
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);

    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await AuthService.login(email, password, ipAddress, userAgent);

    const avatarUrl = result.user.avatar
      ? await StorageService.getSignedUrl(result.user.avatar, 3600).catch(() => null)
      : null;

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          displayName: result.user.displayName,
          avatar: result.user.avatar,
          avatarUrl,
          roles: result.user.roles.map((r) => ({
            id: r.role.id,
            name: r.role.name,
            displayName: r.role.displayName,
          })),
          mustChangePassword: result.user.mustChangePassword,
        },
        tokens: result.tokens,
      },
      message: 'Login successful',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user and invalidate session
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, sessionId } = (req as AuthenticatedRequest).user;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    await AuthService.logout(userId, sessionId, ipAddress);

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const tokens = await AuthService.refreshToken(refreshToken);

    const response: ApiResponse = {
      success: true,
      data: { tokens },
      message: 'Token refreshed successfully',
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user info
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;

    const user = await AuthService.getUserProfile(userId);

    const response: ApiResponse = {
      success: true,
      data: { user },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user's password
 */
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    await AuthService.changePassword(userId, currentPassword, newPassword);

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully. Please log in again.',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = resetPasswordRequestSchema.parse(req.body);

    await AuthService.requestPasswordReset(email);

    const response: ApiResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with token
 */
router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = resetPasswordSchema.parse(req.body);

    await AuthService.resetPassword(token, password);

    const response: ApiResponse = {
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    };

    res.json(response);
  })
);

// Add getUserProfile method to AuthService
declare module '../services/auth.service.js' {
  interface AuthServiceType {
    getUserProfile(userId: string): Promise<unknown>;
  }
}

// Extend AuthService with getUserProfile
import { prisma } from '../lib/prisma.js';

(AuthService as unknown as { getUserProfile: (userId: string) => Promise<unknown> }).getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
          entity: true,
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  // Extract permissions
  const permissions = new Set<string>();
  user.roles.forEach((userRole) => {
    userRole.role.permissions.forEach((rp) => {
      permissions.add(`${rp.permission.resource}:${rp.permission.action}:${rp.permission.scope}`);
    });
  });

  const avatarUrl = user.avatar
    ? await StorageService.getSignedUrl(user.avatar, 3600).catch(() => null)
    : null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatar: user.avatar,
    avatarUrl,
    department: user.department,
    title: user.title,
    status: user.status,
    roles: user.roles.map((r) => ({
      id: r.role.id,
      name: r.role.name,
      displayName: r.role.displayName,
      entityId: r.entityId,
      entityName: r.entity?.name,
    })),
    permissions: Array.from(permissions),
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
  };
};

export default router;
