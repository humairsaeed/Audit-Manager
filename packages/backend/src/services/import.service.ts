import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuditLogService } from '../middleware/audit-log.middleware.js';
import { StorageService } from './storage.service.js';
import { ObservationService } from './observation.service.js';
import { config } from '../config/index.js';
import logger from '../lib/logger.js';
import {
  ImportConfig,
  ImportValidationResult,
  ImportRowError,
  ImportProgress,
  RiskRating,
} from '../types/index.js';

// Header synonyms for intelligent mapping
const HEADER_SYNONYMS: Record<string, string[]> = {
  externalReference: ['nc ref', 'nc reference', 'non-conformance ref', 'finding ref', 'observation ref', 'reference', 'ref no', 'ref #', 'finding id'],
  title: ['observation title', 'finding title', 'title', 'finding name', 'observation name', 'issue title', 'nc title'],
  description: ['observation', 'finding', 'observation description', 'finding description', 'description', 'details', 'issue description', 'nc description', 'finding detail'],
  entity: ['entity', 'audited entity', 'business unit', 'department', 'organization', 'org', 'division', 'location'],
  auditSource: ['audit source', 'source', 'audit name', 'audit', 'audit type'],
  controlDomainArea: ['area', 'process', 'control domain', 'domain', 'function', 'control area', 'iso domain'],
  controlClauseRef: ['clause', 'control clause', 'iso clause', 'clause ref', 'control reference', 'requirement ref', 'clause reference', 'iso reference'],
  controlRequirement: ['requirement', 'control requirement', 'policy', 'regulation', 'standard requirement', 'control description'],
  findingClassification: ['classification', 'finding classification', 'type', 'finding type', 'observation type', 'category', 'nc type'],
  riskRating: ['risk', 'risk rating', 'severity', 'priority', 'risk level', 'impact level', 'criticality'],
  rootCause: ['root cause', 'cause', 'reason', 'why'],
  impact: ['impact', 'business impact', 'effect', 'consequence'],
  recommendation: ['recommendation', 'suggested action', 'auditor recommendation', 'action recommended'],
  responsibleParty: ['responsible party', 'responsible', 'owner', 'action owner', 'assigned to', 'assignee', 'responsible person', 'accountability'],
  correctiveAction: ['corrective action', 'action plan', 'remediation', 'response', 'management action', 'cap', 'corrective action plan', 'management response'],
  openDate: ['open date', 'date opened', 'raised date', 'finding date', 'observation date', 'nc date', 'identified date', 'issue date'],
  targetDate: ['target date', 'due date', 'deadline', 'expected closure', 'closure date', 'target closure', 'planned date'],
  status: ['status', 'observation status', 'finding status', 'current status', 'state'],
  reviewComments: ['review', 'comments', 'review comments', 'update', 'review and update'],
};

// Risk rating normalization
const RISK_NORMALIZATIONS: Record<string, RiskRating> = {
  'critical': 'CRITICAL',
  'very high': 'CRITICAL',
  'high': 'HIGH',
  'significant': 'HIGH',
  'major': 'HIGH',
  'medium': 'MEDIUM',
  'moderate': 'MEDIUM',
  'low': 'LOW',
  'minor': 'LOW',
  'informational': 'INFORMATIONAL',
  'info': 'INFORMATIONAL',
  'observation': 'INFORMATIONAL',
  'opportunity': 'INFORMATIONAL',
};

export class ImportService {
  /**
   * Create a new import job
   */
  static async createImportJob(
    auditId: string,
    file: Express.Multer.File,
    userId: string
  ) {
    // Verify audit exists
    const audit = await prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) {
      throw AppError.notFound('Audit');
    }

    // Calculate file checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicate import
    const existingImport = await prisma.importJob.findFirst({
      where: {
        auditId,
        fileChecksum: checksum,
        status: { in: ['COMPLETED'] },
      },
    });

    if (existingImport) {
      throw AppError.conflict('This file has already been imported for this audit');
    }

    // Store original file
    const filePath = await StorageService.uploadFile(
      file,
      `imports/${auditId}`
    );

    // Create import job
    const importJob = await prisma.importJob.create({
      data: {
        auditId,
        userId,
        originalFileName: file.originalname,
        originalFilePath: filePath,
        fileChecksum: checksum,
        status: 'PENDING',
      },
    });

    return importJob;
  }

  /**
   * Parse and validate Excel file
   */
  static async validateImport(
    importJobId: string,
    mappingConfig?: ImportConfig
  ): Promise<ImportValidationResult> {
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      throw AppError.notFound('Import job');
    }

    // Update status
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'VALIDATING' },
    });

    try {
      // Download file
      const { buffer } = await StorageService.downloadFile(importJob.originalFilePath);

      // Parse Excel
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];

      if (data.length < 2) {
        throw AppError.badRequest('Excel file must have at least a header row and one data row');
      }

      // Check row limit
      if (data.length - 1 > config.import.maxRows) {
        throw AppError.badRequest(`Excel file has too many rows. Maximum allowed: ${config.import.maxRows}`);
      }

      // Get headers and detect mapping
      const headers = (data[0] as string[]).map((h) => String(h || '').trim().toLowerCase());
      const autoMapping = mappingConfig?.mappings || this.autoDetectMapping(headers);

      // Validate each row
      const errors: ImportRowError[] = [];
      const warnings: ImportRowError[] = [];
      const validRows: Record<string, unknown>[] = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i] as unknown[];
        const rowNumber = i + 1; // Excel rows are 1-indexed

        // Skip empty rows
        if (row.every((cell) => !cell || String(cell).trim() === '')) {
          continue;
        }

        const { rowData, rowErrors, rowWarnings } = this.validateRow(
          row,
          headers,
          autoMapping,
          rowNumber
        );

        errors.push(...rowErrors);
        warnings.push(...rowWarnings);

        if (rowErrors.length === 0) {
          validRows.push({ ...rowData, _rowNumber: rowNumber });
        }
      }

      // Update import job with validation results
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: errors.length === 0 ? 'VALIDATED' : 'PENDING',
          totalRows: data.length - 1,
          validationErrors: JSON.parse(JSON.stringify({ errors, warnings })),
          mappingConfig: JSON.parse(JSON.stringify({ mappings: autoMapping })),
        },
      });

      return {
        isValid: errors.filter((e) => e.severity === 'error').length === 0,
        totalRows: data.length - 1,
        validRows: validRows.length,
        errors,
        warnings,
        preview: validRows.slice(0, 10), // Return first 10 valid rows as preview
      };
    } catch (error) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  /**
   * Execute the import
   */
  static async executeImport(
    importJobId: string,
    userId: string,
    ipAddress: string | null,
    mappingOverrides?: ImportConfig
  ): Promise<ImportProgress> {
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
      include: { audit: true },
    });

    if (!importJob) {
      throw AppError.notFound('Import job');
    }

    if (importJob.status !== 'VALIDATED' && importJob.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot execute import with status: ${importJob.status}`);
    }

    // Update status
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'IMPORTING',
        startedAt: new Date(),
      },
    });

    try {
      // Download and parse file again
      const { buffer } = await StorageService.downloadFile(importJob.originalFilePath);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];

      const headers = (data[0] as string[]).map((h) => String(h || '').trim().toLowerCase());
      const mapping = mappingOverrides?.mappings ||
        (importJob.mappingConfig as unknown as { mappings: ImportConfig['mappings'] })?.mappings ||
        this.autoDetectMapping(headers);

      let processedRows = 0;
      let successfulRows = 0;
      let failedRows = 0;
      const failedRowErrors: ImportRowError[] = [];

      // Process in chunks
      const chunkSize = config.import.chunkSize;
      const totalDataRows = data.length - 1;

      for (let i = 1; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length));

        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j] as unknown[];
          const rowNumber = i + j + 1;

          try {
            // Skip empty rows
            if (row.every((cell) => !cell || String(cell).trim() === '')) {
              continue;
            }

            const { rowData, rowErrors } = this.validateRow(row, headers, mapping, rowNumber);

            if (rowErrors.some((e) => e.severity === 'error')) {
              failedRows++;
              failedRowErrors.push(...rowErrors);
              continue;
            }

            // Create observation
            await this.createObservationFromRow(
              importJob.auditId,
              rowData,
              userId,
              importJobId,
              rowNumber
            );

            successfulRows++;
          } catch (error: any) {
            failedRows++;
            failedRowErrors.push({
              row: rowNumber,
              message: error.message || 'Unknown error',
              severity: 'error',
            });
            logger.error(`Import row ${rowNumber} failed:`, error);
          }

          processedRows++;

          // Update progress
          if (processedRows % 10 === 0) {
            await prisma.importJob.update({
              where: { id: importJobId },
              data: {
                processedRows,
                successfulRows,
                failedRows,
                progress: (processedRows / totalDataRows) * 100,
              },
            });
          }
        }
      }

      // Generate error file if there were failures
      let errorFilePath: string | undefined;
      if (failedRowErrors.length > 0) {
        errorFilePath = await this.generateErrorFile(importJobId, failedRowErrors);
      }

      // Finalize import job
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: failedRows === 0 ? 'COMPLETED' : 'COMPLETED',
          processedRows,
          successfulRows,
          failedRows,
          progress: 100,
          completedAt: new Date(),
          errorFilePath,
          validationErrors: failedRowErrors.length > 0 ? JSON.parse(JSON.stringify({ errors: failedRowErrors })) : undefined,
        },
      });

      // Log import
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await AuditLogService.logImport(
        userId,
        user?.email || '',
        importJob.auditId,
        importJobId,
        importJob.originalFileName,
        successfulRows,
        ipAddress
      );

      return {
        jobId: importJobId,
        status: 'COMPLETED',
        progress: 100,
        totalRows: totalDataRows,
        processedRows,
        successfulRows,
        failedRows,
        errors: failedRowErrors,
      };
    } catch (error) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  /**
   * Auto-detect column mapping based on header synonyms
   */
  static autoDetectMapping(headers: string[]): ImportConfig['mappings'] {
    const mappings: ImportConfig['mappings'] = [];

    for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();

        // Check if header matches any synonym
        const matches = synonyms.some((synonym) => {
          const normalizedSynonym = synonym.toLowerCase();
          return (
            header === normalizedSynonym ||
            header.includes(normalizedSynonym) ||
            normalizedSynonym.includes(header)
          );
        });

        if (matches) {
          mappings.push({
            excelColumn: headers[i],
            systemField: field,
            required: ['title', 'description'].includes(field),
          });
          break;
        }
      }
    }

    // Also detect review comment columns (Q1 2024, Q2 2024, etc.)
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const reviewMatch = header.match(/(?:review|update|comments?).*?(?:q(\d)[\s-]?(\d{4}))/i);
      if (reviewMatch) {
        mappings.push({
          excelColumn: header,
          systemField: `reviewComment_Q${reviewMatch[1]}_${reviewMatch[2]}`,
          required: false,
        });
      }
    }

    return mappings;
  }

  /**
   * Validate a single row
   */
  private static validateRow(
    row: unknown[],
    headers: string[],
    mapping: ImportConfig['mappings'],
    rowNumber: number
  ): {
    rowData: Record<string, unknown>;
    rowErrors: ImportRowError[];
    rowWarnings: ImportRowError[];
  } {
    const rowData: Record<string, unknown> = {};
    const rowErrors: ImportRowError[] = [];
    const rowWarnings: ImportRowError[] = [];
    const reviewComments: Array<{ period: string; comment: string }> = [];

    for (const map of mapping) {
      const colIndex = headers.indexOf(map.excelColumn.toLowerCase());
      if (colIndex === -1) continue;

      const value = row[colIndex];
      const stringValue = value ? String(value).trim() : '';

      // Handle review comments specially
      if (map.systemField.startsWith('reviewComment_')) {
        if (stringValue) {
          const match = map.systemField.match(/reviewComment_Q(\d)_(\d{4})/);
          if (match) {
            reviewComments.push({
              period: `Q${match[1]} ${match[2]}`,
              comment: stringValue,
            });
          }
        }
        continue;
      }

      // Check required fields
      if (map.required && !stringValue) {
        rowErrors.push({
          row: rowNumber,
          column: map.excelColumn,
          field: map.systemField,
          message: `Required field "${map.systemField}" is empty`,
          severity: 'error',
        });
        continue;
      }

      // Transform and validate specific fields
      switch (map.systemField) {
        case 'riskRating':
          const normalizedRisk = this.normalizeRiskRating(stringValue);
          if (!normalizedRisk && stringValue) {
            rowWarnings.push({
              row: rowNumber,
              column: map.excelColumn,
              value: stringValue,
              message: `Unknown risk rating "${stringValue}", defaulting to MEDIUM`,
              severity: 'warning',
            });
            rowData[map.systemField] = 'MEDIUM';
          } else {
            rowData[map.systemField] = normalizedRisk || 'MEDIUM';
          }
          break;

        case 'openDate':
        case 'targetDate':
          const date = this.parseDate(value);
          if (!date && stringValue) {
            rowErrors.push({
              row: rowNumber,
              column: map.excelColumn,
              value: stringValue,
              message: `Invalid date format for "${map.systemField}"`,
              severity: 'error',
            });
          } else if (date) {
            rowData[map.systemField] = date;
          }
          break;

        case 'status':
          rowData[map.systemField] = this.normalizeStatus(stringValue);
          break;

        default:
          rowData[map.systemField] = stringValue || null;
      }
    }

    // Add review comments
    if (reviewComments.length > 0) {
      rowData['reviewComments'] = reviewComments;
    }

    // Set defaults
    if (!rowData['openDate']) {
      rowData['openDate'] = new Date();
    }
    if (!rowData['targetDate']) {
      // Default target date based on risk rating
      const riskDays: Record<string, number> = {
        CRITICAL: 14,
        HIGH: 30,
        MEDIUM: 60,
        LOW: 90,
        INFORMATIONAL: 180,
      };
      const days = riskDays[rowData['riskRating'] as string] || 60;
      rowData['targetDate'] = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    if (!rowData['riskRating']) {
      rowData['riskRating'] = 'MEDIUM';
    }

    return { rowData, rowErrors, rowWarnings };
  }

  /**
   * Create observation from imported row data
   */
  private static async createObservationFromRow(
    auditId: string,
    rowData: Record<string, unknown>,
    userId: string,
    importJobId: string,
    rowNumber: number
  ) {
    // Try to find owner by responsible party text
    let ownerId: string | undefined;
    if (rowData['responsibleParty']) {
      const potentialOwner = await prisma.user.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [
            { email: { contains: String(rowData['responsibleParty']), mode: 'insensitive' } },
            { displayName: { contains: String(rowData['responsibleParty']), mode: 'insensitive' } },
            { firstName: { contains: String(rowData['responsibleParty']), mode: 'insensitive' } },
            { lastName: { contains: String(rowData['responsibleParty']), mode: 'insensitive' } },
          ],
        },
      });
      if (potentialOwner) {
        ownerId = potentialOwner.id;
      }
    }

    // Try to find entity
    let entityId: string | undefined;
    if (rowData['entity']) {
      const entity = await prisma.entity.findFirst({
        where: {
          OR: [
            { code: { equals: String(rowData['entity']), mode: 'insensitive' } },
            { name: { contains: String(rowData['entity']), mode: 'insensitive' } },
          ],
        },
      });
      if (entity) {
        entityId = entity.id;
      }
    }

    // Create observation
    const observation = await ObservationService.createObservation(
      {
        auditId,
        externalReference: rowData['externalReference'] as string | undefined,
        auditSource: rowData['auditSource'] as string | undefined,
        entityId,
        controlDomainArea: rowData['controlDomainArea'] as string | undefined,
        controlClauseRef: rowData['controlClauseRef'] as string | undefined,
        controlRequirement: rowData['controlRequirement'] as string | undefined,
        title: (rowData['title'] as string) || `Imported Observation ${rowNumber}`,
        description: (rowData['description'] as string) || 'Imported from Excel',
        findingClassification: rowData['findingClassification'] as string | undefined,
        riskRating: (rowData['riskRating'] as RiskRating) || 'MEDIUM',
        rootCause: rowData['rootCause'] as string | undefined,
        impact: rowData['impact'] as string | undefined,
        recommendation: rowData['recommendation'] as string | undefined,
        responsiblePartyText: rowData['responsibleParty'] as string | undefined,
        ownerId,
        correctiveActionPlan: rowData['correctiveAction'] as string | undefined,
        openDate: rowData['openDate'] as Date,
        targetDate: rowData['targetDate'] as Date,
      },
      userId
    );

    // Link to import job
    await prisma.observation.update({
      where: { id: observation.id },
      data: {
        importJobId,
        importRowNumber: rowNumber,
      },
    });

    // Create review cycles from imported comments
    const reviewComments = rowData['reviewComments'] as Array<{ period: string; comment: string }> | undefined;
    if (reviewComments && reviewComments.length > 0) {
      for (const rc of reviewComments) {
        await ObservationService.addReviewCycle(
          observation.id,
          rc.period,
          rc.comment,
          userId,
          false
        );
      }
    }

    return observation;
  }

  /**
   * Normalize risk rating from various formats
   */
  private static normalizeRiskRating(value: string): RiskRating | null {
    const normalized = value.toLowerCase().trim();
    return RISK_NORMALIZATIONS[normalized] || null;
  }

  /**
   * Normalize status from various formats
   */
  private static normalizeStatus(value: string): string {
    const normalized = value.toLowerCase().trim();
    const statusMap: Record<string, string> = {
      'open': 'OPEN',
      'in progress': 'IN_PROGRESS',
      'in-progress': 'IN_PROGRESS',
      'pending': 'OPEN',
      'evidence submitted': 'EVIDENCE_SUBMITTED',
      'under review': 'UNDER_REVIEW',
      'review': 'UNDER_REVIEW',
      'closed': 'CLOSED',
      'complete': 'CLOSED',
      'completed': 'CLOSED',
      'rejected': 'REJECTED',
      'overdue': 'OVERDUE',
    };
    return statusMap[normalized] || 'OPEN';
  }

  /**
   * Parse date from various formats
   */
  private static parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return value;
    }

    const stringValue = String(value).trim();

    // Try parsing as ISO date
    let date = new Date(stringValue);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common date formats
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
      /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = stringValue.match(format);
      if (match) {
        if (format.source.startsWith('^(\\d{2})')) {
          // DD/MM/YYYY or DD-MM-YYYY
          date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        } else {
          // YYYY/MM/DD or YYYY-MM-DD
          date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try Excel serial date number
    const numValue = Number(stringValue);
    if (!isNaN(numValue) && numValue > 0 && numValue < 100000) {
      // Excel serial date (days since 1900-01-01)
      const excelDate = new Date((numValue - 25569) * 86400 * 1000);
      if (!isNaN(excelDate.getTime())) {
        return excelDate;
      }
    }

    return null;
  }

  /**
   * Generate error report file
   */
  private static async generateErrorFile(
    importJobId: string,
    errors: ImportRowError[]
  ): Promise<string> {
    const workbook = XLSX.utils.book_new();
    const wsData = [
      ['Row', 'Column', 'Field', 'Value', 'Error Message', 'Severity'],
      ...errors.map((e) => [
        e.row,
        e.column || '',
        e.field || '',
        e.value || '',
        e.message,
        e.severity,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Errors');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const file = {
      buffer,
      originalname: `import_errors_${importJobId}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
    } as Express.Multer.File;

    return StorageService.uploadFile(file, `imports/errors`);
  }

  /**
   * Rollback an import
   */
  static async rollbackImport(importJobId: string, reason: string, userId: string) {
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
      include: {
        observations: true,
      },
    });

    if (!importJob) {
      throw AppError.notFound('Import job');
    }

    if (importJob.status !== 'COMPLETED') {
      throw AppError.badRequest('Can only rollback completed imports');
    }

    // Delete all imported observations
    await prisma.observation.deleteMany({
      where: { importJobId },
    });

    // Update import job status
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'ROLLED_BACK',
        rolledBackAt: new Date(),
        rollbackReason: reason,
      },
    });

    logger.info(`Import ${importJobId} rolled back by user ${userId}: ${reason}`);

    return true;
  }

  /**
   * Get import job status
   */
  static async getImportJobStatus(importJobId: string): Promise<ImportProgress> {
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      throw AppError.notFound('Import job');
    }

    return {
      jobId: importJob.id,
      status: importJob.status as ImportProgress['status'],
      progress: importJob.progress,
      totalRows: importJob.totalRows,
      processedRows: importJob.processedRows,
      successfulRows: importJob.successfulRows,
      failedRows: importJob.failedRows,
      errors: (importJob.validationErrors as { errors?: ImportRowError[] })?.errors,
    };
  }

  /**
   * Get available mapping templates
   */
  static async getMappingTemplates() {
    return prisma.importMappingTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Create mapping template
   */
  static async createMappingTemplate(
    name: string,
    mappings: ImportConfig['mappings'],
    description: string | undefined,
    createdById: string
  ) {
    return prisma.importMappingTemplate.create({
      data: {
        name,
        description,
        mappings: JSON.parse(JSON.stringify(mappings)),
        createdById,
      },
    });
  }
}
