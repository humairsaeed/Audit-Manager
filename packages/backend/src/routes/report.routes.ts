import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ApiResponse, RESOURCES, ACTIONS } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/reports/aging
 * @desc Get aging report
 */
router.get(
  '/aging',
  requirePermission(RESOURCES.REPORT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      entityId: req.query.entityId as string,
    };

    const agingData = await DashboardService.getAgingReport(filters);

    const response: ApiResponse = {
      success: true,
      data: agingData,
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/reports/export
 * @desc Export report
 */
router.post(
  '/export',
  requirePermission(RESOURCES.REPORT, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    // For now, return a simple response - full export implementation would need PDF/Excel generation
    const response: ApiResponse = {
      success: true,
      message: 'Export functionality coming soon',
    };

    res.json(response);
  })
);

export default router;
