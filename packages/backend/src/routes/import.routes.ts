import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { ImportService } from '../services/import.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, ApiResponse, SYSTEM_ROLES, ColumnMapping } from '../types/index.js';

const router = Router();

// Configure multer for Excel/CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['xlsx', 'xls', 'csv'];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext && allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed'));
    }
  },
});

// All routes require authentication and audit admin role
router.use(authenticate);
router.use(requireRole(SYSTEM_ROLES.SYSTEM_ADMIN, SYSTEM_ROLES.AUDIT_ADMIN));

/**
 * @route POST /api/v1/import/upload
 * @desc Upload Excel file for import
 */
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { auditId } = z.object({ auditId: z.string().uuid() }).parse(req.body);

    const importJob = await ImportService.createImportJob(
      auditId,
      req.file,
      authReq.user.userId
    );

    const response: ApiResponse = {
      success: true,
      data: { importJob },
      message: 'File uploaded successfully. Proceed to validation.',
    };

    res.status(201).json(response);
  })
);

/**
 * @route POST /api/v1/import/:jobId/validate
 * @desc Validate import file and preview mappings
 */
router.post(
  '/:jobId/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const mappingConfig = req.body.mappingConfig;

    const validation = await ImportService.validateImport(jobId, mappingConfig);

    const response: ApiResponse = {
      success: true,
      data: { validation },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/import/:jobId/execute
 * @desc Execute the import
 */
router.post(
  '/:jobId/execute',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { jobId } = req.params;
    const ipAddress = req.ip || null;
    const mappingOverrides = req.body.mappingConfig;

    const result = await ImportService.executeImport(
      jobId,
      authReq.user.userId,
      ipAddress,
      mappingOverrides
    );

    const response: ApiResponse = {
      success: true,
      data: { result },
      message: `Import completed: ${result.successfulRows} observations created`,
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/import/:jobId/status
 * @desc Get import job status
 */
router.get(
  '/:jobId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    const status = await ImportService.getImportJobStatus(jobId);

    const response: ApiResponse = {
      success: true,
      data: { status },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/import/:jobId/rollback
 * @desc Rollback an import
 */
router.post(
  '/:jobId/rollback',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { jobId } = req.params;
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    await ImportService.rollbackImport(jobId, reason, authReq.user.userId);

    const response: ApiResponse = {
      success: true,
      message: 'Import rolled back successfully',
    };

    res.json(response);
  })
);

/**
 * @route GET /api/v1/import/templates
 * @desc Get available mapping templates
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await ImportService.getMappingTemplates();

    const response: ApiResponse = {
      success: true,
      data: { templates },
    };

    res.json(response);
  })
);

/**
 * @route POST /api/v1/import/templates
 * @desc Create a new mapping template
 */
router.post(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { name, mappings, description } = z.object({
      name: z.string().min(1),
      mappings: z.array(z.object({
        excelColumn: z.string(),
        systemField: z.string(),
        required: z.boolean().default(false),
      })),
      description: z.string().optional(),
    }).parse(req.body);

    const template = await ImportService.createMappingTemplate(
      name,
      mappings as ColumnMapping[],
      description,
      authReq.user.userId
    );

    const response: ApiResponse = {
      success: true,
      data: { template },
      message: 'Mapping template created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * @route GET /api/v1/import/detect-columns
 * @desc Detect columns from an Excel file header
 */
router.post(
  '/detect-columns',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const parseCsv = (content: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;

      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i + 1];

        if (char === '"' && inQuotes && next === '"') {
          currentCell += '"';
          i++;
          continue;
        }

        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }

        if (char === ',' && !inQuotes) {
          currentRow.push(currentCell);
          currentCell = '';
          continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
          if (char === '\r' && next === '\n') i++;
          currentRow.push(currentCell);
          if (currentRow.some((cell) => cell.trim() !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
          continue;
        }

        currentCell += char;
      }

      if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell);
        if (currentRow.some((cell) => cell.trim() !== '')) {
          rows.push(currentRow);
        }
      }

      return rows;
    };

    // Parse the first row to get headers
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    if (data.length === 0 || (data[0] || []).length === 0) {
      const ext = req.file.originalname.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const csvContent = req.file.buffer.toString('utf8');
        data = parseCsv(csvContent);
      }
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel file has no data',
      });
    }

    const headers = data[0].map((h) => String(h || '').trim());
    const autoMapping = ImportService.autoDetectMapping(headers.map((h) => h.toLowerCase()));

    const response: ApiResponse = {
      success: true,
      data: {
        headers,
        autoMapping,
        sampleRows: data.slice(1, 6), // First 5 data rows
      },
    };

    res.json(response);
  })
);

export default router;
