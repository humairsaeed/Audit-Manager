import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse, RESOURCES, ACTIONS } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/dashboard/user
 * @desc Get current user's dashboard
 */
router.get(
  '/user',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const dashboard = await DashboardService.getUserDashboard(authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { dashboard },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/dashboard/management
 * @desc Get management dashboard
 */
router.get(
  '/management',
  requirePermission(RESOURCES.DASHBOARD, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      entityId: req.query.entityId as string,
      auditId: req.query.auditId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    const dashboard = await DashboardService.getManagementDashboard(filters);

    const response: ApiResponse = {
      success: true,
      data: { dashboard },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/dashboard/trends
 * @desc Get trend data for charts
 */
router.get(
  '/trends',
  requirePermission(RESOURCES.DASHBOARD, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const months = parseInt(req.query.months as string) || 6;
    const filters = {
      entityId: req.query.entityId as string,
      auditId: req.query.auditId as string,
    };

    const trends = await DashboardService.getTrendData(months, filters);

    const response: ApiResponse = {
      success: true,
      data: { trends },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/dashboard/risk-exposure
 * @desc Get risk exposure summary
 */
router.get(
  '/risk-exposure',
  requirePermission(RESOURCES.DASHBOARD, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      entityId: req.query.entityId as string,
      auditId: req.query.auditId as string,
    };

    const riskExposure = await DashboardService.getRiskExposure(filters);

    const response: ApiResponse = {
      success: true,
      data: { riskExposure },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/dashboard/executive-summary
 * @desc Generate executive summary
 */
router.get(
  '/executive-summary',
  requirePermission(RESOURCES.REPORT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      auditIds: req.query.auditIds ? (req.query.auditIds as string).split(',') : undefined,
      entityIds: req.query.entityIds ? (req.query.entityIds as string).split(',') : undefined,
    };

    const summary = await DashboardService.generateExecutiveSummary(filters);

    const response: ApiResponse = {
      success: true,
      data: { summary },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/dashboard/compliance-status
 * @desc Get compliance status by entity
 */
router.get(
  '/compliance-status',
  requirePermission(RESOURCES.DASHBOARD, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      entityId: req.query.entityId as string,
    };

    const complianceStatus = await DashboardService.getComplianceStatus(filters);

    const response: ApiResponse = {
      success: true,
      data: complianceStatus,
    };

    res.json(response);
  })
);

export default router;
