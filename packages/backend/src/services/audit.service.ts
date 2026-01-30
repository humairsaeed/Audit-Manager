import { Prisma, AuditStatus, AuditType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  CreateAuditDTO,
  UpdateAuditDTO,
  PaginationParams,
  PaginatedResponse,
} from '../types/index.js';

type AuditWithRelations = Prisma.AuditGetPayload<{
  include: {
    entity: true;
    leadAuditor: { select: { id: true; email: true; firstName: true; lastName: true } };
    createdBy: { select: { id: true; email: true; firstName: true; lastName: true } };
    teamMembers: { include: { user: { select: { id: true; email: true; firstName: true; lastName: true } } } };
    _count: { select: { observations: true; documents: true } };
  };
}>;

export class AuditService {
  /**
   * Create a new audit
   */
  static async createAudit(
    data: CreateAuditDTO,
    createdById: string
  ): Promise<AuditWithRelations> {
    // Verify entity exists
    const entity = await prisma.entity.findUnique({
      where: { id: data.entityId },
    });

    if (!entity) {
      throw AppError.badRequest('Invalid entity ID');
    }

    // Verify lead auditor exists if specified
    if (data.leadAuditorId) {
      const leadAuditor = await prisma.user.findUnique({
        where: { id: data.leadAuditorId },
      });

      if (!leadAuditor) {
        throw AppError.badRequest('Invalid lead auditor ID');
      }
    }

    // Generate audit number
    const year = new Date().getFullYear();
    const count = await prisma.audit.count({
      where: {
        auditNumber: { startsWith: `AUD-${year}` },
      },
    });
    const auditNumber = `AUD-${year}-${String(count + 1).padStart(4, '0')}`;

    // Create audit
    const audit = await prisma.audit.create({
      data: {
        auditNumber,
        name: data.name,
        description: data.description,
        type: data.type,
        entityId: data.entityId,
        scope: data.scope,
        objectives: data.objectives,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        leadAuditorId: data.leadAuditorId,
        externalAuditorName: data.externalAuditorName,
        externalAuditorFirm: data.externalAuditorFirm,
        createdById,
        teamMembers: data.teamMemberIds?.length
          ? {
              create: data.teamMemberIds.map((userId) => ({
                userId,
                role: 'Member',
                addedBy: createdById,
              })),
            }
          : undefined,
      },
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
    });

    return audit;
  }

  /**
   * Get audit by ID
   */
  static async getAuditById(id: string): Promise<AuditWithRelations> {
    const audit = await prisma.audit.findUnique({
      where: { id },
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
    });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    return audit;
  }

  /**
   * Get audit by audit number
   */
  static async getAuditByNumber(auditNumber: string): Promise<AuditWithRelations> {
    const audit = await prisma.audit.findUnique({
      where: { auditNumber },
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
    });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    return audit;
  }

  /**
   * List audits with pagination and filtering
   */
  static async listAudits(
    params: PaginationParams,
    filters?: {
      search?: string;
      type?: AuditType;
      status?: AuditStatus;
      entityId?: string;
      leadAuditorId?: string;
      periodStart?: Date;
      periodEnd?: Date;
    }
  ): Promise<PaginatedResponse<AuditWithRelations>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.AuditWhereInput = {
      deletedAt: null,
    };

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { auditNumber: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters?.leadAuditorId) {
      where.leadAuditorId = filters.leadAuditorId;
    }

    if (filters?.periodStart || filters?.periodEnd) {
      where.AND = [];
      if (filters.periodStart) {
        (where.AND as Prisma.AuditWhereInput[]).push({
          periodEnd: { gte: filters.periodStart },
        });
      }
      if (filters.periodEnd) {
        (where.AND as Prisma.AuditWhereInput[]).push({
          periodStart: { lte: filters.periodEnd },
        });
      }
    }

    // Get total count
    const total = await prisma.audit.count({ where });

    // Get audits
    const audits = await prisma.audit.findMany({
      where,
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const auditIds = audits.map((audit) => audit.id);
    const now = new Date();

    const statusCounts = auditIds.length
      ? await prisma.observation.groupBy({
          by: ['auditId', 'status'],
          where: {
            auditId: { in: auditIds },
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];

    const overdueCounts = auditIds.length
      ? await prisma.observation.groupBy({
          by: ['auditId'],
          where: {
            auditId: { in: auditIds },
            deletedAt: null,
            status: { not: 'CLOSED' },
            targetDate: { lt: now },
          },
          _count: { _all: true },
        })
      : [];

    const closedMap = new Map<string, number>();
    const totalMap = new Map<string, number>();
    for (const row of statusCounts) {
      const currentTotal = totalMap.get(row.auditId) || 0;
      totalMap.set(row.auditId, currentTotal + row._count._all);
      if (row.status === 'CLOSED') {
        closedMap.set(row.auditId, row._count._all);
      }
    }

    const overdueMap = new Map(
      overdueCounts.map((row) => [row.auditId, row._count._all])
    );

    const auditsWithStats = audits.map((audit) => ({
      ...audit,
      totalObservations: totalMap.get(audit.id) ?? audit._count?.observations ?? 0,
      closedObservations: closedMap.get(audit.id) ?? 0,
      overdueObservations: overdueMap.get(audit.id) ?? 0,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: auditsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update audit
   */
  static async updateAudit(
    id: string,
    data: UpdateAuditDTO
  ): Promise<AuditWithRelations> {
    const audit = await prisma.audit.findUnique({ where: { id } });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    // Validate status transitions
    if (data.status) {
      this.validateStatusTransition(audit.status, data.status);
    }

    const updated = await prisma.audit.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        scope: data.scope,
        objectives: data.objectives,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        actualStartDate: data.actualStartDate,
        actualEndDate: data.actualEndDate,
        status: data.status,
        leadAuditorId: data.leadAuditorId,
        externalAuditorName: data.externalAuditorName,
        externalAuditorFirm: data.externalAuditorFirm,
        riskAssessment: data.riskAssessment,
        executiveSummary: data.executiveSummary,
        closedAt: data.status === 'CLOSED' ? new Date() : undefined,
      },
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
    });

    return updated;
  }

  /**
   * Update audit status
   */
  static async updateStatus(
    id: string,
    status: AuditStatus
  ): Promise<AuditWithRelations> {
    const audit = await prisma.audit.findUnique({ where: { id } });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    this.validateStatusTransition(audit.status, status);

    return prisma.audit.update({
      where: { id },
      data: {
        status,
        actualStartDate: status === 'IN_PROGRESS' && !audit.actualStartDate
          ? new Date()
          : undefined,
        closedAt: status === 'CLOSED' ? new Date() : undefined,
      },
      include: {
        entity: true,
        leadAuditor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { observations: true, documents: true },
        },
      },
    });
  }

  /**
   * Add team member
   */
  static async addTeamMember(
    auditId: string,
    userId: string,
    role: string,
    addedById: string
  ) {
    const audit = await prisma.audit.findUnique({ where: { id: auditId } });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw AppError.badRequest('Invalid user ID');
    }

    // Check if already a team member
    const existing = await prisma.auditTeamMember.findUnique({
      where: { auditId_userId: { auditId, userId } },
    });

    if (existing) {
      throw AppError.conflict('User is already a team member');
    }

    return prisma.auditTeamMember.create({
      data: {
        auditId,
        userId,
        role,
        addedBy: addedById,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Remove team member
   */
  static async removeTeamMember(auditId: string, userId: string) {
    const audit = await prisma.audit.findUnique({ where: { id: auditId } });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    const teamMember = await prisma.auditTeamMember.findUnique({
      where: { auditId_userId: { auditId, userId } },
    });

    if (!teamMember) {
      throw AppError.notFound('Team member');
    }

    await prisma.auditTeamMember.delete({
      where: { auditId_userId: { auditId, userId } },
    });

    return true;
  }

  /**
   * Delete audit (soft delete)
   */
  static async deleteAudit(id: string): Promise<boolean> {
    const audit = await prisma.audit.findUnique({
      where: { id },
    });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    // Check if audit has observations
    const activeObservations = await prisma.observation.count({
      where: { auditId: id, deletedAt: null },
    });
    if (activeObservations > 0) {
      throw AppError.badRequest(
        'Cannot delete audit with observations. Please delete all observations first.'
      );
    }

    await prisma.audit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(auditId: string) {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        observations: {
          select: {
            status: true,
            riskRating: true,
            targetDate: true,
          },
          where: { deletedAt: null },
        },
      },
    });

    if (!audit) {
      throw AppError.notFound('Audit');
    }

    const now = new Date();
    const stats = {
      total: audit.observations.length,
      byStatus: {} as Record<string, number>,
      byRiskRating: {} as Record<string, number>,
      overdue: 0,
      dueThisWeek: 0,
    };

    for (const obs of audit.observations) {
      // Count by status
      stats.byStatus[obs.status] = (stats.byStatus[obs.status] || 0) + 1;

      // Count by risk rating
      stats.byRiskRating[obs.riskRating] = (stats.byRiskRating[obs.riskRating] || 0) + 1;

      // Count overdue
      if (obs.targetDate < now && obs.status !== 'CLOSED') {
        stats.overdue++;
      }

      // Count due this week
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (obs.targetDate >= now && obs.targetDate <= weekFromNow && obs.status !== 'CLOSED') {
        stats.dueThisWeek++;
      }
    }

    return stats;
  }

  /**
   * Validate status transition
   */
  private static validateStatusTransition(
    currentStatus: AuditStatus,
    newStatus: AuditStatus
  ): void {
    const validTransitions: Record<AuditStatus, AuditStatus[]> = {
      PLANNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['UNDER_REVIEW', 'CANCELLED'],
      UNDER_REVIEW: ['IN_PROGRESS', 'CLOSED', 'CANCELLED'],
      CLOSED: [], // Cannot transition from CLOSED
      CANCELLED: [], // Cannot transition from CANCELLED
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
