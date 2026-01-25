import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../services/audit.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse, RESOURCES, ACTIONS } from '../types/index.js';

const router = Router();

// Validation schemas
const createAuditSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'ISO', 'SOC', 'ISR', 'FINANCIAL', 'IT', 'REGULATORY', 'CUSTOM']),
  entityId: z.string().uuid(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  periodStart: z.string().transform((s) => new Date(s)),
  periodEnd: z.string().transform((s) => new Date(s)),
  plannedStartDate: z.string().transform((s) => new Date(s)).optional(),
  plannedEndDate: z.string().transform((s) => new Date(s)).optional(),
  leadAuditorId: z.string().uuid().optional(),
  externalAuditorName: z.string().optional(),
  externalAuditorFirm: z.string().optional(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
});

const updateAuditSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  periodStart: z.string().transform((s) => new Date(s)).optional(),
  periodEnd: z.string().transform((s) => new Date(s)).optional(),
  plannedStartDate: z.string().transform((s) => new Date(s)).optional(),
  plannedEndDate: z.string().transform((s) => new Date(s)).optional(),
  actualStartDate: z.string().transform((s) => new Date(s)).optional(),
  actualEndDate: z.string().transform((s) => new Date(s)).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED']).optional(),
  leadAuditorId: z.string().uuid().optional(),
  externalAuditorName: z.string().optional(),
  externalAuditorFirm: z.string().optional(),
  riskAssessment: z.string().optional(),
  executiveSummary: z.string().optional(),
});

const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().default('Member'),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/audits
 * @desc List audits with pagination and filtering
 */
router.get(
  '/',
  requirePermission(RESOURCES.AUDIT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const filters = {
      search: req.query.search as string,
      type: req.query.type as any,
      status: req.query.status as any,
      entityId: req.query.entityId as string,
      leadAuditorId: req.query.leadAuditorId as string,
      periodStart: req.query.periodStart ? new Date(req.query.periodStart as string) : undefined,
      periodEnd: req.query.periodEnd ? new Date(req.query.periodEnd as string) : undefined,
    };

    const result = await AuditService.listAudits(
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
 * @route POST /api/v1/audits
 * @desc Create a new audit
 */
router.post(
  '/',
  requirePermission(RESOURCES.AUDIT, ACTIONS.CREATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = createAuditSchema.parse(req.body);

    const audit = await AuditService.createAudit(data, authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { audit },
      message: 'Audit created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/audits/:id
 * @desc Get audit by ID
 */
router.get(
  '/:id',
  requirePermission(RESOURCES.AUDIT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const audit = await AuditService.getAuditById(id);

    const response: ApiResponse = {
      success: true,
      data: { audit },
    };

    res.json(response);
  })
);

/**
 * @route PUT /api/v1/audits/:id
 * @desc Update audit
 */
router.put(
  '/:id',
  requirePermission(RESOURCES.AUDIT, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateAuditSchema.parse(req.body);

    const audit = await AuditService.updateAudit(id, data);

    const response: ApiResponse = {
      success: true,
      data: { audit },
      message: 'Audit updated successfully',
    };

    res.json(response);
  })
);

/**
 * @route PATCH /api/v1/audits/:id/status
 * @desc Update audit status
 */
router.patch(
  '/:id/status',
  requirePermission(RESOURCES.AUDIT, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = z.object({
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED']),
    }).parse(req.body);

    const audit = await AuditService.updateStatus(id, status);

    const response: ApiResponse = {
      success: true,
      data: { audit },
      message: `Audit status updated to ${status}`,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/audits/:id/stats
 * @desc Get audit statistics
 */
router.get(
  '/:id/stats',
  requirePermission(RESOURCES.AUDIT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const stats = await AuditService.getAuditStats(id);

    const response: ApiResponse = {
      success: true,
      data: { stats },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/audits/:id/team-members
 * @desc Add team member to audit
 */
router.post(
  '/:id/team-members',
  requirePermission(RESOURCES.AUDIT, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { userId, role } = addTeamMemberSchema.parse(req.body);

    const teamMember = await AuditService.addTeamMember(
      id,
      userId,
      role,
      authReq.user.userId
    );

    const response: ApiResponse = {
      success: true,
      data: { teamMember },
      message: 'Team member added successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route DELETE /api/v1/audits/:id/team-members/:userId
 * @desc Remove team member from audit
 */
router.delete(
  '/:id/team-members/:userId',
  requirePermission(RESOURCES.AUDIT, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id, userId } = req.params;

    await AuditService.removeTeamMember(id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Team member removed successfully',
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/audits/:id
 * @desc Delete audit (soft delete)
 */
router.delete(
  '/:id',
  requirePermission(RESOURCES.AUDIT, ACTIONS.DELETE),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await AuditService.deleteAudit(id);

    const response: ApiResponse = {
      success: true,
      message: 'Audit deleted successfully',
    };

    res.json(response);
  })
);

export default router;
