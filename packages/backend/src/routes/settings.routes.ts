import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { prisma } from '../lib/prisma.js';
import { ApiResponse, RESOURCES, ACTIONS } from '../types/index.js';

const router = Router();

// Settings schema
const settingsSchema = z.object({
  general: z.object({
    applicationName: z.string().optional(),
    organizationName: z.string().optional(),
    defaultTimezone: z.string().optional(),
    dateFormat: z.string().optional(),
  }).optional(),
  sla: z.object({
    critical: z.number().optional(),
    high: z.number().optional(),
    medium: z.number().optional(),
    low: z.number().optional(),
    informational: z.number().optional(),
  }).optional(),
  notifications: z.object({
    emailEnabled: z.boolean().optional(),
    teamsEnabled: z.boolean().optional(),
    reminderDaysBefore: z.array(z.number()).optional(),
    overdueReminderFrequency: z.string().optional(),
  }).optional(),
  security: z.object({
    passwordMinLength: z.number().optional(),
    passwordRequireUppercase: z.boolean().optional(),
    passwordRequireNumbers: z.boolean().optional(),
    passwordRequireSpecial: z.boolean().optional(),
    sessionTimeout: z.number().optional(),
    maxLoginAttempts: z.number().optional(),
  }).optional(),
  audit: z.object({
    defaultAuditType: z.string().optional(),
    requireApproval: z.boolean().optional(),
    autoCloseThreshold: z.number().optional(),
  }).optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/settings
 * @desc Get system settings
 */
router.get(
  '/',
  requirePermission(RESOURCES.SYSTEM_CONFIG, ACTIONS.READ),
  asyncHandler(async (_req: Request, res: Response) => {
    // Get settings from database or return defaults
    const settings = await prisma.systemConfig.findMany();

    // Convert array to object
    const settingsObj: Record<string, any> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    const response: ApiResponse = {
      success: true,
      data: settingsObj,
    };

    res.json(response);
  })
);

/**
 * @route PUT /api/v1/settings
 * @desc Update system settings
 */
router.put(
  '/',
  requirePermission(RESOURCES.SYSTEM_CONFIG, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const data = settingsSchema.parse(req.body);

    // Upsert each settings category
    const operations = [];
    for (const [category, values] of Object.entries(data)) {
      if (values) {
        operations.push(
          prisma.systemConfig.upsert({
            where: { key: category },
            update: {
              value: values as any,
            },
            create: {
              key: category,
              value: values as any,
            },
          })
        );
      }
    }

    await prisma.$transaction(operations);

    // Fetch updated settings
    const settings = await prisma.systemConfig.findMany();
    const settingsObj: Record<string, any> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    const response: ApiResponse = {
      success: true,
      data: settingsObj,
      message: 'Settings updated successfully',
    };

    res.json(response);
  })
);

export default router;
