import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { EvidenceService } from '../services/evidence.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { NotificationService } from '../services/notification.service.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest, ApiResponse, RESOURCES, ACTIONS, ReviewEvidenceDTO } from '../types/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.storage.maxFileSizeMB * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext && config.storage.allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} not allowed`));
    }
  },
});

// Validation schemas
const uploadEvidenceSchema = z.object({
  observationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const reviewEvidenceSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewRemarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/evidence/observation/:observationId
 * @desc List evidence for an observation
 */
router.get(
  '/observation/:observationId',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { observationId } = req.params;
    const includeSuperseded = req.query.includeSuperseded === 'true';

    const evidence = await EvidenceService.listEvidence(observationId, includeSuperseded);

    const response: ApiResponse = {
      success: true,
      data: { evidence },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/evidence
 * @desc Upload evidence for an observation
 */
router.post(
  '/',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.CREATE),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { observationId, name, description } = uploadEvidenceSchema.parse(req.body);
    const ipAddress = req.ip || null;

    const evidence = await EvidenceService.uploadEvidence(
      observationId,
      req.file,
      name,
      description,
      authReq.user.userId,
      ipAddress
    );

    const response: ApiResponse = {
      success: true,
      data: { evidence },
      message: 'Evidence uploaded successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route POST /api/v1/evidence/multiple
 * @desc Upload multiple evidence files
 */
router.post(
  '/multiple',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.CREATE),
  upload.array('files', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const { observationId } = z.object({ observationId: z.string().uuid() }).parse(req.body);
    const ipAddress = req.ip || null;

    const uploadedEvidence = [];
    const errors = [];

    for (const file of files) {
      try {
        const evidence = await EvidenceService.uploadEvidence(
          observationId,
          file,
          file.originalname,
          undefined,
          authReq.user.userId,
          ipAddress
        );
        uploadedEvidence.push(evidence);
      } catch (error: any) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        uploaded: uploadedEvidence,
        errors,
        totalUploaded: uploadedEvidence.length,
        totalFailed: errors.length,
      },
      message: `${uploadedEvidence.length} file(s) uploaded successfully`,
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/evidence/:id
 * @desc Get evidence by ID
 */
router.get(
  '/:id',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const evidence = await EvidenceService.getEvidenceById(id);

    const response: ApiResponse = {
      success: true,
      data: { evidence },
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/evidence/:id/download
 * @desc Get download URL for evidence
 */
router.get(
  '/:id/download',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const { url, fileName, mimeType } = await EvidenceService.getDownloadUrl(
      id,
      authReq.user.userId
    );

    const response: ApiResponse = {
      success: true,
      data: { url, fileName, mimeType },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/evidence/:id/review
 * @desc Review evidence (approve or reject)
 */
router.post(
  '/:id/review',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.APPROVE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const review = reviewEvidenceSchema.parse(req.body);

    const evidence = await EvidenceService.reviewEvidence(id, review as ReviewEvidenceDTO, authReq.user.userId);

    // Send notification
    if (evidence.uploadedBy) {
      const notificationType = review.status === 'APPROVED' ? 'EVIDENCE_APPROVED' : 'EVIDENCE_REJECTED';
      await NotificationService.sendNotification({
        type: notificationType,
        userId: evidence.uploadedBy.id,
        observationId: evidence.observationId,
        channels: ['EMAIL', 'IN_APP'],
        data: {
          observationTitle: evidence.observation.title,
          evidenceName: evidence.name,
          reviewerComments: review.reviewRemarks,
          rejectionReason: review.rejectionReason,
          url: `${process.env.FRONTEND_URL}/observations/${evidence.observationId}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { evidence },
      message: `Evidence ${review.status.toLowerCase()}`,
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/evidence/observation/:observationId/submit-for-review
 * @desc Submit all evidence for review
 */
router.post(
  '/observation/:observationId/submit-for-review',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { observationId } = req.params;

    const observation = await EvidenceService.submitForReview(observationId, authReq.user.userId);

    // Notify reviewer
    if (observation.reviewerId) {
      await NotificationService.sendNotification({
        type: 'REVIEW_REQUIRED',
        userId: observation.reviewerId,
        observationId,
        channels: ['EMAIL', 'IN_APP'],
        data: {
          observationTitle: observation.title,
          auditName: observation.audit.name,
          evidenceCount: observation.evidence.length,
          url: `${process.env.FRONTEND_URL}/observations/${observationId}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Evidence submitted for review',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/evidence/observation/:observationId/approve-and-close
 * @desc Approve all evidence and close observation
 */
router.post(
  '/observation/:observationId/approve-and-close',
  requirePermission(RESOURCES.OBSERVATION, ACTIONS.APPROVE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { observationId } = req.params;
    const { remarks } = z.object({ remarks: z.string().optional() }).parse(req.body);

    const observation = await EvidenceService.approveAndClose(
      observationId,
      authReq.user.userId,
      remarks
    );

    // Notify owner
    if (observation?.ownerId) {
      await NotificationService.sendNotification({
        type: 'OBSERVATION_CLOSED',
        userId: observation.ownerId,
        observationId,
        channels: ['EMAIL', 'IN_APP'],
        data: {
          observationTitle: observation.title,
          auditName: '', // Would need to fetch
          closedBy: authReq.user.email,
          closureDate: new Date().toISOString().split('T')[0],
          url: `${process.env.FRONTEND_URL}/observations/${observationId}`,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { observation },
      message: 'Observation closed successfully',
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/evidence/:id/supersede
 * @desc Supersede evidence with new version
 */
router.post(
  '/:id/supersede',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.CREATE),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { name, description } = z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }).parse(req.body);

    const ipAddress = req.ip || null;

    const evidence = await EvidenceService.supersedeEvidence(
      id,
      req.file,
      name,
      description,
      authReq.user.userId,
      ipAddress
    );

    const response: ApiResponse = {
      success: true,
      data: { evidence },
      message: 'Evidence superseded successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/evidence/observation/:observationId/stats
 * @desc Get evidence statistics for observation
 */
router.get(
  '/observation/:observationId/stats',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.READ),
  asyncHandler(async (req: Request, res: Response) => {
    const { observationId } = req.params;

    const stats = await EvidenceService.getEvidenceStats(observationId);

    const response: ApiResponse = {
      success: true,
      data: { stats },
    };

    res.json(response);
  })
);

/**
 * @route DELETE /api/v1/evidence/:id
 * @desc Delete evidence (soft delete)
 */
router.delete(
  '/:id',
  requirePermission(RESOURCES.EVIDENCE, ACTIONS.DELETE),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    await EvidenceService.deleteEvidence(id, authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      message: 'Evidence deleted successfully',
    };

    res.json(response);
  })
);

export default router;
