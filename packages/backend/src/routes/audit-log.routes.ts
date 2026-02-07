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
              avatar: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Resolve resource names from IDs for display
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let resourceName: string | null = null;

        if (log.resourceId) {
          try {
            if (log.resource === 'observations' || log.resource === 'status' || log.resource === 'comments' || log.resource === 'follow-up') {
              const observation = await prisma.observation.findUnique({
                where: { id: log.resourceId },
                select: { title: true },
              });
              resourceName = observation?.title || null;
            } else if (log.resource === 'audits' || log.resource === 'team' || log.resource === 'documents') {
              const audit = await prisma.audit.findUnique({
                where: { id: log.resourceId },
                select: { name: true },
              });
              resourceName = audit?.name || null;
            } else if (log.resource === 'users' || log.resource === 'user_role') {
              const user = await prisma.user.findUnique({
                where: { id: log.resourceId },
                select: { firstName: true, lastName: true, email: true },
              });
              resourceName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : null;
            } else if (log.resource === 'evidence') {
              const evidence = await prisma.evidence.findUnique({
                where: { id: log.resourceId },
                select: { fileName: true, observation: { select: { title: true } } },
              });
              resourceName = evidence?.observation?.title || evidence?.fileName || null;
            } else if (log.resource === 'insights') {
              // Try to resolve insights to observation name from description
              resourceName = null;
            }
          } catch {
            // Ignore lookup errors
          }
        }

        return {
          ...log,
          resourceName,
        };
      })
    );

    const response: ApiResponse = {
      success: true,
      data: {
        data: enrichedLogs,
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
