import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/notifications
 * @desc Get current user's notifications
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await NotificationService.getUserNotifications(
      authReq.user.userId,
      { unreadOnly, limit, offset }
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/notifications/unread-count
 * @desc Get unread notification count
 */
router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const result = await NotificationService.getUserNotifications(
      authReq.user.userId,
      { unreadOnly: true, limit: 0, offset: 0 }
    );

    const response: ApiResponse = {
      success: true,
      data: { count: result.unreadCount },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/notifications/:id/read
 * @desc Mark notification as read
 */
router.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    await NotificationService.markAsRead(id, authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      message: 'Notification marked as read',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/notifications/read-all
 * @desc Mark all notifications as read
 */
router.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    await NotificationService.markAllAsRead(authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      message: 'All notifications marked as read',
    };

    res.json(response);
  })
);

export default router;
