import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AIObservationService } from '../services/ai-observation.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse, SYSTEM_ROLES } from '../types/index.js';

const router = Router();

// Validation schemas
const getInsightsSchema = z.object({
  insightTypes: z.array(
    z.enum([
      'VALIDATION',
      'RECOMMENDATIONS',
      'EVIDENCE_GUIDANCE',
      'ROLE_GUIDANCE',
      'EXECUTIVE_SUMMARY',
      'FULL_ANALYSIS',
    ])
  ).min(1, 'At least one insight type is required'),
  forceRefresh: z.boolean().optional().default(false),
  userRole: z.enum(['AUDITOR', 'AUDITEE']).optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/v1/ai/observations/:id/insights
 * @desc Get AI-powered insights for an observation
 * @access Auditor, Compliance Manager, Admin roles only
 */
router.post(
  '/observations/:id/insights',
  requireRole(
    SYSTEM_ROLES.SYSTEM_ADMIN,
    SYSTEM_ROLES.AUDIT_ADMIN,
    SYSTEM_ROLES.COMPLIANCE_MANAGER,
    SYSTEM_ROLES.AUDITOR
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const body = getInsightsSchema.parse(req.body);

    const insights = await AIObservationService.getInsights(
      {
        observationId: id,
        insightTypes: body.insightTypes,
        forceRefresh: body.forceRefresh,
        userRole: body.userRole,
      },
      authReq.user.userId,
      authReq.user.email,
      authReq.user.roles
    );

    const response: ApiResponse = {
      success: true,
      data: insights,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/ai/observations/:id/insights/history
 * @desc Get history of AI insights for an observation
 * @access Auditor, Compliance Manager, Admin roles only
 */
router.get(
  '/observations/:id/insights/history',
  requireRole(
    SYSTEM_ROLES.SYSTEM_ADMIN,
    SYSTEM_ROLES.AUDIT_ADMIN,
    SYSTEM_ROLES.COMPLIANCE_MANAGER,
    SYSTEM_ROLES.AUDITOR
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await AIObservationService.getInsightHistory(id, limit);

    const response: ApiResponse = {
      success: true,
      data: { history },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/ai/observations/:id/insights/:insightId
 * @desc Get specific AI insight by ID
 * @access Auditor, Compliance Manager, Admin roles only
 */
router.get(
  '/observations/:id/insights/:insightId',
  requireRole(
    SYSTEM_ROLES.SYSTEM_ADMIN,
    SYSTEM_ROLES.AUDIT_ADMIN,
    SYSTEM_ROLES.COMPLIANCE_MANAGER,
    SYSTEM_ROLES.AUDITOR
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const { insightId } = req.params;

    const insight = await AIObservationService.getInsightById(insightId);

    const response: ApiResponse = {
      success: true,
      data: { insight },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/ai/evidence/:evidenceId/review
 * @desc Review uploaded evidence using AI
 * @access Auditor, Compliance Manager, Admin roles only
 */
router.post(
  '/evidence/:evidenceId/review',
  requireRole(
    SYSTEM_ROLES.SYSTEM_ADMIN,
    SYSTEM_ROLES.AUDIT_ADMIN,
    SYSTEM_ROLES.COMPLIANCE_MANAGER,
    SYSTEM_ROLES.AUDITOR
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { evidenceId } = req.params;

    const reviewResult = await AIObservationService.reviewEvidence(
      evidenceId,
      authReq.user.userId,
      authReq.user.email,
      authReq.user.roles
    );

    const response: ApiResponse = {
      success: true,
      data: reviewResult,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/ai/evidence/:evidenceId/review
 * @desc Get AI review for a specific evidence item
 * @access Auditor, Compliance Manager, Admin roles only
 */
router.get(
  '/evidence/:evidenceId/review',
  requireRole(
    SYSTEM_ROLES.SYSTEM_ADMIN,
    SYSTEM_ROLES.AUDIT_ADMIN,
    SYSTEM_ROLES.COMPLIANCE_MANAGER,
    SYSTEM_ROLES.AUDITOR
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const { evidenceId } = req.params;

    const review = await AIObservationService.getEvidenceReview(evidenceId);

    const response: ApiResponse = {
      success: true,
      data: { review },
    };

    res.json(response);
  })
);

export default router;
