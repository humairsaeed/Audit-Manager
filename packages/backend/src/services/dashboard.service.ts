import { Prisma, ObservationStatus, RiskRating } from '@prisma/client';
import { startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import {
  DashboardStats,
  AgingBucket,
  ReportFilters,
} from '../types/index.js';

export class DashboardService {
  /**
   * Get user's personal dashboard stats
   */
  static async getUserDashboard(userId: string): Promise<{
    myObservations: {
      total: number;
      byStatus: Record<string, number>;
      overdue: number;
      dueToday: number;
      dueThisWeek: number;
    };
    pendingReviews: number;
    recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: Date;
      observationId?: string;
    }>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    // Get user's observations
    const observations = await prisma.observation.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        status: { not: 'CLOSED' },
      },
      select: {
        id: true,
        status: true,
        targetDate: true,
      },
    });

    const myObservations = {
      total: observations.length,
      byStatus: {} as Record<string, number>,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
    };

    for (const obs of observations) {
      myObservations.byStatus[obs.status] = (myObservations.byStatus[obs.status] || 0) + 1;

      if (obs.targetDate < today) {
        myObservations.overdue++;
      } else if (obs.targetDate >= today && obs.targetDate < tomorrow) {
        myObservations.dueToday++;
      } else if (obs.targetDate >= today && obs.targetDate < weekFromNow) {
        myObservations.dueThisWeek++;
      }
    }

    // Get pending reviews (observations where user is reviewer)
    const pendingReviews = await prisma.observation.count({
      where: {
        reviewerId: userId,
        deletedAt: null,
        status: 'EVIDENCE_SUBMITTED',
      },
    });

    // Get recent activity
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          {
            resource: 'observation',
            resourceId: { in: observations.map((o) => o.id) },
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        description: true,
        timestamp: true,
        resourceId: true,
        resource: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const observationIds = Array.from(
      new Set(
        recentActivity
          .filter((activity) => activity.resource === 'observation' || activity.resource === 'observations')
          .map((activity) => activity.resourceId)
          .filter(Boolean)
      )
    ) as string[];

    const observationSummaries = observationIds.length
      ? await prisma.observation.findMany({
          where: { id: { in: observationIds } },
          select: { id: true, globalSequence: true, title: true },
        })
      : [];

    const observationMap = new Map(
      observationSummaries.map((obs) => [
        obs.id,
        `${obs.globalSequence}${obs.title ? ` - ${obs.title}` : ''}`,
      ])
    );

    return {
      myObservations,
      pendingReviews,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.action,
        description: (() => {
          const label = a.resourceId ? observationMap.get(a.resourceId) : undefined;
          if (!label) return a.description;

          if (a.description.includes(a.resourceId)) {
            return a.description
              .replace(/observations\b/g, 'observation')
              .replaceAll(a.resourceId, label);
          }

          if (['CREATE', 'UPDATE', 'DELETE'].includes(a.action)) {
            const verb = a.action === 'CREATE' ? 'Created' : a.action === 'DELETE' ? 'Deleted' : 'Updated';
            return `${verb} observation ${label}`;
          }

          return a.description;
        })(),
        timestamp: a.timestamp,
        observationId: a.resourceId || undefined,
        userName: a.user
          ? `${a.user.firstName} ${a.user.lastName}`.trim() || a.user.email || 'User'
          : 'System',
      })),
    };
  }

  /**
   * Get management dashboard stats
   */
  static async getManagementDashboard(filters?: {
    entityId?: string;
    auditId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<DashboardStats> {
    const where: Prisma.ObservationWhereInput = {
      deletedAt: null,
    };

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters?.auditId) {
      where.auditId = filters.auditId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.AND = [];
      if (filters.dateFrom) {
        (where.AND as Prisma.ObservationWhereInput[]).push({ openDate: { gte: filters.dateFrom } });
      }
      if (filters.dateTo) {
        (where.AND as Prisma.ObservationWhereInput[]).push({ openDate: { lte: filters.dateTo } });
      }
    }

    const observations = await prisma.observation.findMany({
      where,
      include: {
        entity: { select: { name: true } },
      },
    });

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Calculate stats
    const byStatus: Record<ObservationStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      EVIDENCE_SUBMITTED: 0,
      UNDER_REVIEW: 0,
      REJECTED: 0,
      CLOSED: 0,
      OVERDUE: 0,
    };

    const byRiskRating: Record<RiskRating, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0,
    };

    const byEntity: Map<string, number> = new Map();
    let openCount = 0;
    let overdueCount = 0;
    let closedThisMonth = 0;
    let onTimeClosures = 0;
    let totalClosures = 0;

    for (const obs of observations) {
      byStatus[obs.status]++;
      byRiskRating[obs.riskRating]++;

      const entityName = obs.entity?.name || 'Unassigned';
      byEntity.set(entityName, (byEntity.get(entityName) || 0) + 1);

      if (obs.status !== 'CLOSED') {
        openCount++;
        if (obs.targetDate < now) {
          overdueCount++;
        }
      }

      if (obs.status === 'CLOSED' && obs.closedAt) {
        totalClosures++;
        if (obs.closedAt >= monthStart && obs.closedAt <= monthEnd) {
          closedThisMonth++;
        }
        if (obs.closedAt <= obs.targetDate) {
          onTimeClosures++;
        }
      }
    }

    // Calculate SLA compliance
    const slaCompliance = totalClosures > 0 ? (onTimeClosures / totalClosures) * 100 : 100;

    // Calculate aging analysis
    const agingAnalysis = this.calculateAgingAnalysis(observations.filter((o) => o.status !== 'CLOSED'));

    // Get recent activity
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        resource: { in: ['observation', 'evidence', 'audit'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      totalObservations: observations.length,
      openObservations: openCount,
      overdueObservations: overdueCount,
      closedThisMonth,
      byStatus,
      byRiskRating,
      byEntity: Array.from(byEntity.entries())
        .map(([entity, count]) => ({ entity, count }))
        .sort((a, b) => b.count - a.count),
      slaCompliance: Math.round(slaCompliance * 10) / 10,
      agingAnalysis,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.action,
        description: a.description,
        userId: a.userId || '',
        userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System',
        timestamp: a.timestamp,
        resourceId: a.resourceId || undefined,
        resourceType: a.resource,
      })),
    };
  }

  /**
   * Get trend data
   */
  static async getTrendData(
    months: number = 6,
    filters?: { entityId?: string; auditId?: string }
  ): Promise<{
    labels: string[];
    opened: number[];
    closed: number[];
    overdue: number[];
  }> {
    const trends = {
      labels: [] as string[],
      opened: [] as number[],
      closed: [] as number[],
      overdue: [] as number[],
    };

    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const where: Prisma.ObservationWhereInput = {
        deletedAt: null,
      };

      if (filters?.entityId) {
        where.entityId = filters.entityId;
      }

      if (filters?.auditId) {
        where.auditId = filters.auditId;
      }

      // Count opened
      const opened = await prisma.observation.count({
        where: {
          ...where,
          openDate: { gte: monthStart, lte: monthEnd },
        },
      });

      // Count closed
      const closed = await prisma.observation.count({
        where: {
          ...where,
          closedAt: { gte: monthStart, lte: monthEnd },
        },
      });

      // Count overdue at end of month
      const overdue = await prisma.observation.count({
        where: {
          ...where,
          targetDate: { lte: monthEnd },
          OR: [
            { closedAt: null },
            { closedAt: { gt: monthEnd } },
          ],
        },
      });

      trends.labels.push(monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      trends.opened.push(opened);
      trends.closed.push(closed);
      trends.overdue.push(overdue);
    }

    return trends;
  }

  /**
   * Get risk exposure summary
   */
  static async getRiskExposure(filters?: {
    entityId?: string;
    auditId?: string;
  }): Promise<{
    byEntity: Array<{
      entity: string;
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    }>;
    byAudit: Array<{
      audit: string;
      auditId: string;
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    }>;
  }> {
    const where: Prisma.ObservationWhereInput = {
      deletedAt: null,
      status: { not: 'CLOSED' },
    };

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters?.auditId) {
      where.auditId = filters.auditId;
    }

    const observations = await prisma.observation.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
        audit: { select: { id: true, name: true } },
      },
    });

    // Group by entity
    const entityMap = new Map<string, { critical: number; high: number; medium: number; low: number }>();
    const auditMap = new Map<string, { id: string; critical: number; high: number; medium: number; low: number }>();

    for (const obs of observations) {
      const entityName = obs.entity?.name || 'Unassigned';
      const auditName = obs.audit.name;

      if (!entityMap.has(entityName)) {
        entityMap.set(entityName, { critical: 0, high: 0, medium: 0, low: 0 });
      }
      if (!auditMap.has(auditName)) {
        auditMap.set(auditName, { id: obs.audit.id, critical: 0, high: 0, medium: 0, low: 0 });
      }

      const entityData = entityMap.get(entityName)!;
      const auditData = auditMap.get(auditName)!;

      switch (obs.riskRating) {
        case 'CRITICAL':
          entityData.critical++;
          auditData.critical++;
          break;
        case 'HIGH':
          entityData.high++;
          auditData.high++;
          break;
        case 'MEDIUM':
          entityData.medium++;
          auditData.medium++;
          break;
        case 'LOW':
        case 'INFORMATIONAL':
          entityData.low++;
          auditData.low++;
          break;
      }
    }

    return {
      byEntity: Array.from(entityMap.entries())
        .map(([entity, data]) => ({
          entity,
          ...data,
          total: data.critical + data.high + data.medium + data.low,
        }))
        .sort((a, b) => (b.critical * 4 + b.high * 3 + b.medium * 2 + b.low) -
          (a.critical * 4 + a.high * 3 + a.medium * 2 + a.low)),
      byAudit: Array.from(auditMap.entries())
        .map(([audit, data]) => ({
          audit,
          auditId: data.id,
          critical: data.critical,
          high: data.high,
          medium: data.medium,
          low: data.low,
          total: data.critical + data.high + data.medium + data.low,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Generate executive summary
   */
  static async generateExecutiveSummary(filters?: ReportFilters): Promise<{
    period: string;
    summary: string;
    totalObservations: number;
    closedObservations: number;
    overdueObservations: number;
    closureRate: number;
    byRisk: Record<RiskRating, number>;
    byStatus: Record<ObservationStatus, number>;
    byEntity: Record<string, { total: number; open: number; closed: number; overdue: number }>;
    keyMetrics: {
      label: string;
      value: string | number;
      trend?: 'up' | 'down' | 'stable';
    }[];
    riskHighlights: string[];
    recommendations: string[];
  }> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const where: Prisma.ObservationWhereInput = {
      deletedAt: null,
    };

    if (filters?.auditIds?.length) {
      where.auditId = { in: filters.auditIds };
    }

    if (filters?.entityIds?.length) {
      where.entityId = { in: filters.entityIds };
    }

    if (filters?.auditType) {
      where.audit = { type: filters.auditType };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.AND = [];
      if (filters.dateFrom) {
        (where.AND as Prisma.ObservationWhereInput[]).push({
          openDate: { gte: filters.dateFrom },
        });
      }
      if (filters.dateTo) {
        (where.AND as Prisma.ObservationWhereInput[]).push({
          openDate: { lte: filters.dateTo },
        });
      }
    }

    const observations = await prisma.observation.findMany({
      where,
      include: {
        entity: { select: { name: true } },
      },
    });

    const byStatus: Record<ObservationStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      EVIDENCE_SUBMITTED: 0,
      UNDER_REVIEW: 0,
      REJECTED: 0,
      CLOSED: 0,
      OVERDUE: 0,
    };

    const byRisk: Record<RiskRating, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0,
    };

    const byEntity: Record<string, { total: number; open: number; closed: number; overdue: number }> = {};
    let closedObservations = 0;
    let overdueObservations = 0;

    for (const obs of observations) {
      byStatus[obs.status]++;
      byRisk[obs.riskRating]++;

      const entityName = obs.entity?.name || 'Unassigned';
      if (!byEntity[entityName]) {
        byEntity[entityName] = { total: 0, open: 0, closed: 0, overdue: 0 };
      }
      byEntity[entityName].total++;

      if (obs.status === 'CLOSED') {
        closedObservations++;
        byEntity[entityName].closed++;
      } else {
        byEntity[entityName].open++;
        if (obs.targetDate < now) {
          overdueObservations++;
          byEntity[entityName].overdue++;
        }
      }
    }

    const totalObservations = observations.length;
    const closureRate = totalObservations > 0 ? (closedObservations / totalObservations) * 100 : 0;

    // Current period stats
    const currentStats = await this.getManagementDashboard({
      entityId: filters?.entityIds?.length === 1 ? filters.entityIds[0] : undefined,
      auditId: filters?.auditIds?.length === 1 ? filters.auditIds[0] : undefined,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
    });

    // Previous period stats
    const prevMonthClosed = await prisma.observation.count({
      where: {
        ...where,
        closedAt: { gte: prevMonthStart, lte: prevMonthEnd },
      },
    });

    // Calculate trends
    const closedTrend = currentStats.closedThisMonth > prevMonthClosed
      ? 'up'
      : currentStats.closedThisMonth < prevMonthClosed
        ? 'down'
        : 'stable';

    // Generate highlights
    const riskHighlights: string[] = [];
    if (byRisk.CRITICAL > 0) {
      riskHighlights.push(`${byRisk.CRITICAL} critical observations require immediate attention`);
    }
    if (overdueObservations > 0) {
      riskHighlights.push(`${overdueObservations} observations are past their due date`);
    }
    if (currentStats.slaCompliance < 80) {
      riskHighlights.push(`SLA compliance is below target at ${currentStats.slaCompliance}%`);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (overdueObservations > 5) {
      recommendations.push('Consider escalating overdue observations to management');
    }
    if (byRisk.CRITICAL > 3) {
      recommendations.push('Schedule urgent review meeting for critical findings');
    }
    if (currentStats.byStatus.UNDER_REVIEW > 10) {
      recommendations.push('Additional reviewer capacity may be needed');
    }

    return {
      period: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      summary: `As of ${now.toLocaleDateString()}, there are ${currentStats.openObservations} open observations across the organization. ${currentStats.closedThisMonth} observations were closed this month, with an SLA compliance rate of ${currentStats.slaCompliance}%.`,
      totalObservations,
      closedObservations,
      overdueObservations,
      closureRate,
      byRisk,
      byStatus,
      byEntity,
      keyMetrics: [
        { label: 'Open Observations', value: currentStats.openObservations },
        { label: 'Overdue', value: overdueObservations },
        { label: 'Closed This Month', value: currentStats.closedThisMonth, trend: closedTrend },
        { label: 'SLA Compliance', value: `${currentStats.slaCompliance}%` },
        { label: 'Critical Risk', value: byRisk.CRITICAL },
        { label: 'High Risk', value: byRisk.HIGH },
      ],
      riskHighlights,
      recommendations,
    };
  }

  /**
   * Calculate aging analysis buckets
   */
  private static calculateAgingAnalysis(
    observations: Array<{ openDate: Date; targetDate: Date; status: string }>
  ): AgingBucket[] {
    const now = new Date();
    const buckets: AgingBucket[] = [
      { label: '0-30 days', minDays: 0, maxDays: 30, count: 0 },
      { label: '31-60 days', minDays: 31, maxDays: 60, count: 0 },
      { label: '61-90 days', minDays: 61, maxDays: 90, count: 0 },
      { label: '91-180 days', minDays: 91, maxDays: 180, count: 0 },
      { label: '180+ days', minDays: 181, maxDays: null, count: 0 },
    ];

    for (const obs of observations) {
      const daysOpen = differenceInDays(now, obs.openDate);

      for (const bucket of buckets) {
        if (daysOpen >= bucket.minDays && (bucket.maxDays === null || daysOpen <= bucket.maxDays)) {
          bucket.count++;
          break;
        }
      }
    }

    return buckets;
  }

  /**
   * Get compliance status by entity
   */
  static async getComplianceStatus(filters?: { entityId?: string; auditId?: string }) {
    // Get all active entities
    const entities = await prisma.entity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
    });

    // Get observations grouped by entity
    const observationsByEntity = await prisma.observation.groupBy({
      by: ['entityId', 'status'],
      where: {
        deletedAt: null,
        entityId: filters?.entityId || undefined,
        auditId: filters?.auditId || undefined,
      },
      _count: true,
    });

    // Build compliance data
    const entityMap = new Map<string, { total: number; closed: number }>();

    for (const obs of observationsByEntity) {
      if (!obs.entityId) continue;

      if (!entityMap.has(obs.entityId)) {
        entityMap.set(obs.entityId, { total: 0, closed: 0 });
      }

      const entry = entityMap.get(obs.entityId)!;
      entry.total += obs._count;
      if (obs.status === 'CLOSED') {
        entry.closed += obs._count;
      }
    }

    const entitiesWithCompliance = entities
      .map((entity) => {
        const stats = entityMap.get(entity.id) || { total: 0, closed: 0 };
        const complianceRate = stats.total > 0 ? (stats.closed / stats.total) * 100 : 100;

        return {
          id: entity.id,
          name: entity.name,
          totalCount: stats.total,
          closedCount: stats.closed,
          openCount: stats.total - stats.closed,
          complianceRate,
        };
      })
      .filter((e) => e.totalCount > 0);

    return { entities: entitiesWithCompliance };
  }

  /**
   * Get aging report data
   */
  static async getAgingReport(filters?: { entityId?: string; auditId?: string }) {
    const where: Prisma.ObservationWhereInput = {
      deletedAt: null,
      status: { not: 'CLOSED' },
    };

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters?.auditId) {
      where.auditId = filters.auditId;
    }

    const observations = await prisma.observation.findMany({
      where,
      select: {
        openDate: true,
        riskRating: true,
      },
    });

    const now = new Date();
    const bucketRanges = [
      { range: '0-30 days', min: 0, max: 30 },
      { range: '31-60 days', min: 31, max: 60 },
      { range: '61-90 days', min: 61, max: 90 },
      { range: '91-180 days', min: 91, max: 180 },
      { range: '180+ days', min: 181, max: Infinity },
    ];

    const buckets = bucketRanges.map((range) => ({
      range: range.range,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
      total: 0,
    }));

    for (const obs of observations) {
      const daysOpen = differenceInDays(now, obs.openDate);

      for (let i = 0; i < bucketRanges.length; i++) {
        const { min, max } = bucketRanges[i];
        if (daysOpen >= min && daysOpen <= max) {
          const riskKey = obs.riskRating.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'informational';
          buckets[i][riskKey]++;
          buckets[i].total++;
          break;
        }
      }
    }

    return { buckets };
  }
}
