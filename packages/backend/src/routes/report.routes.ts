import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ApiResponse, RESOURCES, ACTIONS, ReportFilters } from '../types/index.js';

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
      auditId: req.query.auditId as string,
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
    const schema = z.object({
      type: z.enum(['summary', 'trends', 'compliance', 'aging']),
      format: z.enum(['pdf', 'excel']),
      dateRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
      filters: z
        .object({
          entityId: z.string().optional(),
          auditId: z.string().optional(),
          auditType: z.string().optional(),
          auditIds: z.array(z.string()).optional(),
          entityIds: z.array(z.string()).optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional(),
    });

    const payload = schema.parse(req.body);
    const dateFrom = payload.dateRange?.start
      ? new Date(payload.dateRange.start)
      : payload.filters?.dateFrom
      ? new Date(payload.filters.dateFrom)
      : undefined;
    const dateTo = payload.dateRange?.end
      ? new Date(payload.dateRange.end)
      : payload.filters?.dateTo
      ? new Date(payload.filters.dateTo)
      : undefined;

    const filters: ReportFilters = {
      auditType: payload.filters?.auditType as any,
      auditIds: payload.filters?.auditIds ?? (payload.filters?.auditId ? [payload.filters.auditId] : undefined),
      entityIds: payload.filters?.entityIds,
      dateFrom,
      dateTo,
    };

    const format = payload.format;
    const type = payload.type;

    const fileBase = `${type}-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new();

      if (type === 'summary') {
        const summary = await DashboardService.generateExecutiveSummary(filters);
        const kpiSheet = XLSX.utils.aoa_to_sheet([
          ['Metric', 'Value'],
          ['Period', summary.period],
          ['Total Observations', summary.totalObservations],
          ['Closed Observations', summary.closedObservations],
          ['Overdue Observations', summary.overdueObservations],
          ['Closure Rate (%)', summary.closureRate],
        ]);
        XLSX.utils.book_append_sheet(workbook, kpiSheet, 'Summary');

        const riskSheet = XLSX.utils.aoa_to_sheet([
          ['Risk Rating', 'Count'],
          ...Object.entries(summary.byRisk).map(([risk, count]) => [risk, count]),
        ]);
        XLSX.utils.book_append_sheet(workbook, riskSheet, 'By Risk');

        const statusSheet = XLSX.utils.aoa_to_sheet([
          ['Status', 'Count'],
          ...Object.entries(summary.byStatus).map(([status, count]) => [status, count]),
        ]);
        XLSX.utils.book_append_sheet(workbook, statusSheet, 'By Status');

        const entitySheet = XLSX.utils.aoa_to_sheet([
          ['Entity', 'Total', 'Open', 'Closed', 'Overdue'],
          ...Object.entries(summary.byEntity).map(([entity, data]) => [
            entity,
            data.total,
            data.open,
            data.closed,
            data.overdue,
          ]),
        ]);
        XLSX.utils.book_append_sheet(workbook, entitySheet, 'By Entity');
      } else if (type === 'trends') {
        const trends = await DashboardService.getTrendData(12, {
          entityId: payload.filters?.entityId,
          auditId: payload.filters?.auditId,
        });
        const sheet = XLSX.utils.aoa_to_sheet([
          ['Month', 'Opened', 'Closed', 'Overdue'],
          ...trends.labels.map((label, idx) => [
            label,
            trends.opened[idx] ?? 0,
            trends.closed[idx] ?? 0,
            trends.overdue[idx] ?? 0,
          ]),
        ]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Trends');
      } else if (type === 'compliance') {
        const compliance = await DashboardService.getComplianceStatus({
          entityId: payload.filters?.entityId,
          auditId: payload.filters?.auditId,
        });
        const sheet = XLSX.utils.aoa_to_sheet([
          ['Entity', 'Compliance Rate (%)', 'Total', 'Closed', 'Open'],
          ...compliance.entities.map((entity) => [
            entity.name,
            Number(entity.complianceRate.toFixed(2)),
            entity.totalCount,
            entity.closedCount,
            entity.openCount,
          ]),
        ]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Compliance');
      } else if (type === 'aging') {
        const aging = await DashboardService.getAgingReport({
          entityId: payload.filters?.entityId,
          auditId: payload.filters?.auditId,
        });
        const sheet = XLSX.utils.aoa_to_sheet([
          ['Age Bucket', 'Critical', 'High', 'Medium', 'Low', 'Informational', 'Total'],
          ...aging.buckets.map((bucket) => [
            bucket.range,
            bucket.critical,
            bucket.high,
            bucket.medium,
            bucket.low,
            bucket.informational,
            bucket.total,
          ]),
        ]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Aging');
      }

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
      res.status(200).send(buffer);
      return;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text('Audit Management Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Report Type: ${type.toUpperCase()}`);
    if (dateFrom || dateTo) {
      doc.text(`Date Range: ${dateFrom ? dateFrom.toDateString() : 'N/A'} - ${dateTo ? dateTo.toDateString() : 'N/A'}`);
    }
    doc.moveDown();

    if (type === 'summary') {
      const summary = await DashboardService.generateExecutiveSummary(filters);
      doc.fontSize(14).text('Executive Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(summary.summary);
      doc.moveDown();
      doc.fontSize(12).text('Key Metrics');
      summary.keyMetrics.forEach((metric) => {
        doc.fontSize(11).text(`- ${metric.label}: ${metric.value}`);
      });
      doc.moveDown();
      doc.fontSize(12).text('Risk Distribution');
      Object.entries(summary.byRisk).forEach(([risk, count]) => {
        doc.fontSize(11).text(`- ${risk}: ${count}`);
      });
      doc.moveDown();
      doc.fontSize(12).text('Status Distribution');
      Object.entries(summary.byStatus).forEach(([status, count]) => {
        doc.fontSize(11).text(`- ${status}: ${count}`);
      });
    } else if (type === 'trends') {
      const trends = await DashboardService.getTrendData(12, {
        entityId: payload.filters?.entityId,
        auditId: payload.filters?.auditId,
      });
      doc.fontSize(14).text('Trends Analysis', { underline: true });
      doc.moveDown(0.5);
      trends.labels.forEach((label, idx) => {
        doc.fontSize(11).text(
          `${label}: Opened ${trends.opened[idx] ?? 0}, Closed ${trends.closed[idx] ?? 0}, Overdue ${trends.overdue[idx] ?? 0}`
        );
      });
    } else if (type === 'compliance') {
      const compliance = await DashboardService.getComplianceStatus({
        entityId: payload.filters?.entityId,
        auditId: payload.filters?.auditId,
      });
      doc.fontSize(14).text('Compliance Status', { underline: true });
      doc.moveDown(0.5);
      compliance.entities.forEach((entity) => {
        doc.fontSize(11).text(
          `${entity.name}: ${entity.complianceRate.toFixed(1)}% (Closed ${entity.closedCount} / Total ${entity.totalCount})`
        );
      });
    } else if (type === 'aging') {
      const aging = await DashboardService.getAgingReport({
        entityId: payload.filters?.entityId,
        auditId: payload.filters?.auditId,
      });
      doc.fontSize(14).text('Aging Report', { underline: true });
      doc.moveDown(0.5);
      aging.buckets.forEach((bucket) => {
        doc.fontSize(11).text(
          `${bucket.range}: Critical ${bucket.critical}, High ${bucket.high}, Medium ${bucket.medium}, Low ${bucket.low}, Informational ${bucket.informational}, Total ${bucket.total}`
        );
      });
    }

    doc.end();
    const pdfBuffer = await pdfDone;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.pdf"`);
    res.status(200).send(pdfBuffer);
  })
);

export default router;
