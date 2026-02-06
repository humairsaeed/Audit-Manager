import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ApiResponse, SYSTEM_ROLES } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/audit-logs
 * @desc List audit logs with pagination and filtering
 * @access Admin
 */
router.get(
  '/',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const search = (req.query.search as string) || '';
    const action = req.query.action as string | undefined;
    const resource = req.query.resource as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const where: any = {};

    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = dateFrom;
      if (dateTo) where.timestamp.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    };

    res.json(response);
  })
);

export default router;
