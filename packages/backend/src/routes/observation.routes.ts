import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObservationService } from '../services/observation.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { prisma } from '../lib/prisma.js';
import { NotificationService } from '../services/notification.service.js';
import { AuthenticatedRequest, ApiResponse, RESOURCES, ACTIONS, CreateObservationDTO, SYSTEM_ROLES } from '../types/index.js';

const router = Router();

// Validation schemas
const createObservationSchema = z.object({
  auditId: z.string().uuid(),
  externalReference: z.string().optional(),
  auditSource: z.string().optional(),
  entityId: z.string().uuid().optional(),
  controlDomainArea: z.string().optional(),
  controlId: z.string().uuid().optional(),
  controlClauseRef: z.string().optional(),
  controlRequirement: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  findingClassification: z.string().optional(),
  riskRating: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
  rootCause: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  responsiblePartyText: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  correctiveActionPlan: z.string().optional(),
  managementResponse: z.string().optional(),
  openDate: z.string().transform((s) => new Date(s)),
  targetDate: z.string().transform((s) => new Date(s)),
  tags: z.array(z.string()).optional(),
});

const updateObservationSchema = z.object({
  externalReference: z.string().optional(),
  entityId: z.string().uuid().optional().nullable(),
  controlDomainArea: z.string().optional(),
  controlId: z.string().uuid().optional().nullable(),
  controlClauseRef: z.string().optional(),
  controlRequirement: z.string().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  findingClassification: z.string().optional(),
  riskRating: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']).optional(),
  rootCause: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  responsiblePartyText: z.string().optional(),
  ownerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  correctiveActionPlan: z.string().optional(),
  managementResponse: z.string().optional(),
  targetDate: z.string().transform((s) => new Date(s)).optional(),
  extensionReason: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'CLOSED', 'OVERDUE']),
  reason: z.string().optional(),
});

const addReviewCycleSchema = z.object({
  period: z.string().min(1),
  comments: z.string().min(1),
  actionRequired: z.boolean().default(false),
  nextReviewDate: z.string().transform((s) => new Date(s)).optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
  parentId: z.string().uuid().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/observations
 * @desc List observations with pagination and filtering
 */
router.get(
  '/',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const filters = {
      search: req.query.search as string,
      auditId: req.query.auditId as string,
      entityId: req.query.entityId as string,
      status: req.query.status ? (req.query.status as string).split(',') as any : undefined,
      riskRating: req.query.riskRating ? (req.query.riskRating as string).split(',') as any : undefined,
      ownerId: req.query.ownerId as string,
      reviewerId: req.query.reviewerId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      overdueOnly: req.query.overdueOnly === 'true',
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    };

    const result = await ObservationService.listObservations(
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
 * @route GET /api/v1/observations/my
 * @desc Get current user's observations
 */
router.get(
  '/my',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as string) || 'targetDate';
    const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
    const overdueOnly = req.query.overdueOnly === 'true';

    const result = await ObservationService.listObservations(
      { page, limit, sortBy, sortOrder },
      { ownerId: authReq.user.userId, overdueOnly }
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/observations/due-soon
 * @desc Get observations due soon
 */
router.get(
  '/due-soon',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;

    const observations = await ObservationService.getObservationsDueSoon(days);

    const response: ApiResponse = {
      success: true,
      data: { observations },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/observations/overdue
 * @desc Get overdue observations
 */
router.get(
  '/overdue',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const observations = await ObservationService.getOverdueObservations();

    const response: ApiResponse = {
      success: true,
      data: { observations },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/observations
 * @desc Create a new observation
 */
router.post(
  '/',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.CREATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = createObservationSchema.parse(req.body);

    const observation = await ObservationService.createObservation(data as CreateObservationDTO, authReq.user.userId);

    // Send notification if owner is assigned
    if (observation.ownerId && observation.ownerId !== authReq.user.userId) {
      await NotificationService.sendNotification({
        type: 'OBSERVATION_ASSIGNED',
        userId: observation.ownerId,
        observationId: observation.id,
        channels: ['EMAIL', 'IN_APP'],
        data: {
          observationTitle: observation.title,
          auditName: observation.audit.name,
          riskRating: observation.riskRating,
          targetDate: observation.targetDate.toISOString().split('T')[0],
          description: observation.description.substring(0, 200),
          url: `${process.env.FRONTEND_URL}/observations/${observation.id}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: 'Observation created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/observations/:id
 * @desc Get observation by ID
 */
router.get(
  '/:id',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.READ, {
    allowOwner: true,
    ownerField: 'ownerId',
    resourceIdParam: 'id',
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const observation = await ObservationService.getObservationDetails(id);

    const response: ApiResponse = {
      success: true,
      data: { observation },
    };

    res.json(response);
  })
);

/**
 * @route PUT /api/v1/observations/:id
 * @desc Update observation
 */
router.put(
  '/:id',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.UPDATE, {
    allowOwner: true,
    ownerField: 'ownerId',
    resourceIdParam: 'id',
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const data = updateObservationSchema.parse(req.body);

    const observation = await ObservationService.updateObservation(id, data, authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: 'Observation updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route PATCH /api/v1/observations/:id/status
 * @desc Update observation status
 */
router.patch(
  '/:id/status',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.APPROVE, {
    allowOwner: true,
    ownerField: 'ownerId',
    resourceIdParam: 'id',
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { status, reason } = updateStatusSchema.parse(req.body);
    const ipAddress = req.ip || null;

    const observation = await ObservationService.updateStatus(
      id,
      status,
      authReq.user.userId,
      reason,
      ipAddress || undefined
    );

    // Send notification
    if (observation.ownerId) {
      await NotificationService.sendNotification({
        type: 'STATUS_CHANGED',
        userId: observation.ownerId,
        observationId: observation.id,
        channels: ['IN_APP'],
        data: {
          observationTitle: observation.title,
          previousStatus: observation.previousStatus,
          newStatus: status,
          changedBy: authReq.user.email,
          url: `${process.env.FRONTEND_URL}/observations/${observation.id}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: `Observation status updated to ${status}`,
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/observations/:id/assign-owner
 * @desc Assign owner to observation
 */
router.post(
  '/:id/assign-owner',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.ASSIGN),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { ownerId } = z.object({ ownerId: z.string().uuid() }).parse(req.body);
    const ipAddress = req.ip || null;

    const observation = await ObservationService.assignOwner(
      id,
      ownerId,
      authReq.user.userId,
      ipAddress || undefined
    );

    // Send notification to new owner
    if (ownerId !== authReq.user.userId) {
      await NotificationService.sendNotification({
        type: 'OBSERVATION_ASSIGNED',
        userId: ownerId,
        observationId: observation.id,
        channels: ['EMAIL', 'IN_APP'],
        data: {
          observationTitle: observation.title,
          auditName: observation.audit.name,
          riskRating: observation.riskRating,
          targetDate: observation.targetDate.toISOString().split('T')[0],
          description: observation.description.substring(0, 200),
          url: `${process.env.FRONTEND_URL}/observations/${observation.id}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: 'Owner assigned successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/observations/:id/assign-reviewer
 * @desc Assign reviewer to observation
 */
router.post(
  '/:id/assign-reviewer',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.ASSIGN),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { reviewerId } = z.object({ reviewerId: z.string().uuid() }).parse(req.body);

    const observation = await ObservationService.assignReviewer(
      id,
      reviewerId,
      authReq.user.userId
    );

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: 'Reviewer assigned successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/observations/:id/review-cycles
 * @desc Add review cycle comment
 */
router.post(
  '/:id/review-cycles',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { period, comments, actionRequired, nextReviewDate } = addReviewCycleSchema.parse(req.body);

    const reviewCycle = await ObservationService.addReviewCycle(
      id,
      period,
      comments,
      authReq.user.userId,
      actionRequired,
      nextReviewDate
    );

    const response: ApiResponse = {
      success: true,
      data: { reviewCycle },
      message: 'Review cycle added successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route POST /api/v1/observations/:id/comments
 * @desc Add comment to observation
 */
router.post(
  '/:id/comments',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { content, isInternal, parentId } = addCommentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: {
        observationId: id,
        userId: authReq.user.userId,
        content,
        isInternal,
        parentId,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
        },
      },
    });

    // Notify observation owner if commenter is different
    const observation = await prisma.observation.findUnique({
      where: { id },
      select: { ownerId: true, title: true },
    });

    if (observation?.ownerId && observation.ownerId !== authReq.user.userId) {
      await NotificationService.sendNotification({
        type: 'COMMENT_ADDED',
        userId: observation.ownerId,
        observationId: id,
        channels: ['IN_APP'],
        data: {
          observationTitle: observation.title,
          commentBy: comment.user.displayName || `${comment.user.firstName} ${comment.user.lastName}`,
          comment: content.substring(0, 100),
          url: `${process.env.FRONTEND_URL}/observations/${id}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { comment },
      message: 'Comment added successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route DELETE /api/v1/observations/:id
 * @desc Delete observation (soft delete)
 */
router.delete(
  '/:id',
  requireRole(SYSTEM_ROLES.SYSTEM_ADMIN),
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.DELETE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await ObservationService.deleteObservation(id);

    const response: ApiResponse = {
      success: true,
      message: 'Observation deleted successfully',
    };

    res.json(response);
  })
);

export default router;
