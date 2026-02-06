import { Prisma, ObservationStatus, RiskRating } from '@prisma/client';
import { addDays, differenceInDays, isAfter, isBefore } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuditLogService, createAuditLog } from '../middleware/audit-log.middleware.js';
import { NotificationService } from './notification.service.js';
import {
  CreateObservationDTO,
  UpdateObservationDTO,
  PaginationParams,
  PaginatedResponse,
  NotificationType,
  NotificationChannel,
} from '../types/index.js';

type ObservationWithRelations = Prisma.ObservationGetPayload<{
  include: {
    audit: { select: { id: true; auditNumber: true; name: true; type: true } };
    entity: { select: { id: true; code: true; name: true } };
    control: { select: { id: true; clauseRef: true; name: true } };
    owner: { select: { id: true; email: true; firstName: true; lastName: true; displayName: true } };
    reviewer: { select: { id: true; email: true; firstName: true; lastName: true; displayName: true } };
    _count: { select: { evidence: true; comments: true } };
  };
}>;

const observationInclude = {
  audit: { select: { id: true, auditNumber: true, name: true, type: true } },
  entity: { select: { id: true, code: true, name: true } },
  control: { select: { id: true, clauseRef: true, name: true } },
  owner: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
  reviewer: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
  _count: { select: { evidence: true, comments: true } },
};

export class ObservationService {
  /**
   * Create a new observation
   */
  static async createObservation(
    data: CreateObservationDTO,
    createdById: string
  ): Promise<ObservationWithRelations> {
    // Verify audit exists
    const audit = await prisma.audit.findUnique({
      where: { id: data.auditId },
    });

    if (!audit) {
      throw AppError.badRequest('Invalid audit ID');
    }

    // Verify entity if provided
    if (data.entityId) {
      const entity = await prisma.entity.findUnique({
        where: { id: data.entityId },
      });
      if (!entity) {
        throw AppError.badRequest('Invalid entity ID');
      }
    }

    // Verify owner if provided
    if (data.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: data.ownerId },
      });
      if (!owner) {
        throw AppError.badRequest('Invalid owner ID');
      }
    }

    // Get next sequence number for this audit
    const lastObs = await prisma.observation.findFirst({
      where: { auditId: data.auditId },
      orderBy: { sequenceNumber: 'desc' },
    });
    const sequenceNumber = (lastObs?.sequenceNumber || 0) + 1;

    // Generate global sequence
    const globalCount = await prisma.observation.count();
    const globalSequence = `OBS-${new Date().getFullYear()}-${String(globalCount + 1).padStart(6, '0')}`;

    // Calculate SLA
    const slaDays = await this.calculateSLA(data.riskRating, audit.type);
    const slaCalculatedDate = addDays(data.openDate, slaDays);

    // Create observation
    const observation = await prisma.observation.create({
      data: {
        auditId: data.auditId,
        sequenceNumber,
        globalSequence,
        externalReference: data.externalReference,
        auditSource: data.auditSource,
        entityId: data.entityId,
        controlDomainArea: data.controlDomainArea,
        controlId: data.controlId,
        controlClauseRef: data.controlClauseRef,
        controlRequirement: data.controlRequirement,
        title: data.title,
        description: data.description,
        findingClassification: data.findingClassification,
        riskRating: data.riskRating,
        rootCause: data.rootCause,
        impact: data.impact,
        recommendation: data.recommendation,
        responsiblePartyText: data.responsiblePartyText,
        ownerId: data.ownerId,
        reviewerId: data.reviewerId,
        correctiveActionPlan: data.correctiveActionPlan,
        managementResponse: data.managementResponse,
        openDate: data.openDate,
        targetDate: data.targetDate,
        originalTargetDate: data.targetDate,
        slaCalculatedDate,
        slaDays,
        status: 'OPEN',
        tags: data.tags || [],
      },
      include: observationInclude,
    });

    // Record status history
    await prisma.observationStatusHistory.create({
      data: {
        observationId: observation.id,
        toStatus: 'OPEN',
        changedById: createdById,
      },
    });

    return observation;
  }

  /**
   * Get observation by ID
   */
  static async getObservationById(id: string): Promise<ObservationWithRelations> {
    const observation = await prisma.observation.findUnique({
      where: { id },
      include: observationInclude,
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    return observation;
  }

  /**
   * Get observation with full details
   */
  static async getObservationDetails(id: string) {
    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        audit: true,
        entity: true,
        control: { include: { domain: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true, department: true } },
        reviewer: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true, department: true } },
        evidence: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
            replies: {
              where: { deletedAt: null },
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
              },
            },
          },
        },
        reviewCycles: {
          orderBy: { period: 'desc' },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    const statusHistory = observation.statusHistory || [];
    const userIds = Array.from(
      new Set(
        statusHistory
          .map((history) => history.changedById)
          .filter((id) => id && id !== 'SYSTEM')
      )
    );

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
        })
      : [];

    const userMap = new Map(
      users.map((user) => [
        user.id,
        user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email,
      ])
    );

    const enrichedStatusHistory = statusHistory.map((history) => ({
      ...history,
      changedByName:
        history.changedById === 'SYSTEM'
          ? 'System'
          : userMap.get(history.changedById) || history.changedById,
    }));

    return { ...observation, statusHistory: enrichedStatusHistory };
  }

  /**
   * List observations with pagination and filtering
   */
  static async listObservations(
    params: PaginationParams,
    filters?: {
      search?: string;
      auditId?: string;
      entityId?: string;
      status?: ObservationStatus | ObservationStatus[];
      riskRating?: RiskRating | RiskRating[];
      ownerId?: string;
      reviewerId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      overdueOnly?: boolean;
      tags?: string[];
    }
  ): Promise<PaginatedResponse<ObservationWithRelations>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ObservationWhereInput = {
      deletedAt: null,
    };

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { globalSequence: { contains: filters.search, mode: 'insensitive' } },
        { externalReference: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.auditId) {
      where.auditId = filters.auditId;
    }

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters?.riskRating) {
      where.riskRating = Array.isArray(filters.riskRating)
        ? { in: filters.riskRating }
        : filters.riskRating;
    }

    if (filters?.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters?.reviewerId) {
      where.reviewerId = filters.reviewerId;
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

    if (filters?.overdueOnly) {
      where.targetDate = { lt: new Date() };
      where.status = { notIn: ['CLOSED'] };
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Get total count
    const total = await prisma.observation.count({ where });

    // Get observations
    const observations = await prisma.observation.findMany({
      where,
      include: observationInclude,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: observations,
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
   * Update observation
   */
  static async updateObservation(
    id: string,
    data: UpdateObservationDTO,
    updatedById: string
  ): Promise<ObservationWithRelations> {
    const observation = await prisma.observation.findUnique({ where: { id } });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Check if observation can be edited
    if (observation.status === 'CLOSED') {
      throw AppError.badRequest('Cannot edit a closed observation');
    }
    if (
      observation.ownerId === updatedById &&
      ['EVIDENCE_SUBMITTED', 'UNDER_REVIEW'].includes(observation.status)
    ) {
      throw AppError.badRequest('Owner cannot edit an observation after evidence submission');
    }

    // Handle target date extension
    let extensionData = {};
    if (data.targetDate && isAfter(data.targetDate, observation.targetDate)) {
      if (!data.extensionReason) {
        throw AppError.badRequest('Extension reason is required when extending target date');
      }
      extensionData = {
        extensionCount: observation.extensionCount + 1,
        extensionReason: data.extensionReason,
      };
    }

    const updated = await prisma.observation.update({
      where: { id },
      data: {
        externalReference: data.externalReference,
        entityId: data.entityId,
        controlDomainArea: data.controlDomainArea,
        controlId: data.controlId,
        controlClauseRef: data.controlClauseRef,
        controlRequirement: data.controlRequirement,
        title: data.title,
        description: data.description,
        findingClassification: data.findingClassification,
        riskRating: data.riskRating,
        rootCause: data.rootCause,
        impact: data.impact,
        recommendation: data.recommendation,
        responsiblePartyText: data.responsiblePartyText,
        ownerId: data.ownerId,
        reviewerId: data.reviewerId,
        correctiveActionPlan: data.correctiveActionPlan,
        managementResponse: data.managementResponse,
        targetDate: data.targetDate,
        tags: data.tags,
        ...extensionData,
      },
      include: observationInclude,
    });

    const updatedByUser = await prisma.user.findUnique({
      where: { id: updatedById },
      select: { displayName: true, firstName: true, lastName: true, email: true },
    });
    const updatedByName =
      updatedByUser?.displayName ||
      `${updatedByUser?.firstName || ''} ${updatedByUser?.lastName || ''}`.trim() ||
      updatedByUser?.email ||
      'System';

    await this.sendObservationNotification(updated, {
      type: 'OBSERVATION_UPDATED',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        observationTitle: updated.title,
        auditName: updated.audit?.name || 'N/A',
        updatedBy: updatedByName,
        url: `${process.env.FRONTEND_URL}/observations/${updated.id}`,
      },
    });

    return updated;
  }

  /**
   * Update observation status
   */
  static async updateStatus(
    id: string,
    newStatus: ObservationStatus,
    userId: string,
    reason?: string,
    ipAddress?: string
  ): Promise<ObservationWithRelations> {
    const observation = await prisma.observation.findUnique({
      where: { id },
      include: { owner: true },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Validate status transition
    this.validateStatusTransition(observation.status, newStatus);

    // Get user info for audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Update status
    const updated = await prisma.observation.update({
      where: { id },
      data: {
        status: newStatus,
        previousStatus: observation.status,
        statusChangedAt: new Date(),
        statusChangedById: userId,
        closedAt: newStatus === 'CLOSED' ? new Date() : undefined,
      },
      include: observationInclude,
    });

    // Record status history
    await prisma.observationStatusHistory.create({
      data: {
        observationId: id,
        fromStatus: observation.status,
        toStatus: newStatus,
        reason,
        changedById: userId,
      },
    });

    // Log status change
    await AuditLogService.logStatusChange(
      userId,
      user?.email || '',
      'observation',
      id,
      observation.status,
      newStatus,
      ipAddress || null
    );

    const changedByName =
      user?.displayName ||
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      user?.email ||
      'System';

    await this.sendObservationNotification(updated, {
      type: 'STATUS_CHANGED',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        observationTitle: updated.title,
        auditName: updated.audit?.name || 'N/A',
        previousStatus: observation.status,
        newStatus,
        changedBy: changedByName,
        url: `${process.env.FRONTEND_URL}/observations/${updated.id}`,
      },
    });

    return updated;
  }

  /**
   * Assign owner to observation
   */
  static async assignOwner(
    id: string,
    ownerId: string,
    assignedById: string,
    ipAddress?: string
  ): Promise<ObservationWithRelations> {
    const observation = await prisma.observation.findUnique({ where: { id } });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });

    if (!owner) {
      throw AppError.badRequest('Invalid owner ID');
    }

    const updated = await prisma.observation.update({
      where: { id },
      data: { ownerId },
      include: observationInclude,
    });

    // Log assignment
    await AuditLogService.logAssignment(
      assignedById,
      '', // Would need to fetch assigner email
      'observation',
      id,
      ownerId,
      owner.displayName || `${owner.firstName} ${owner.lastName}`,
      ipAddress || null
    );

    await this.sendObservationNotification(updated, {
      type: 'OBSERVATION_ASSIGNED',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        observationTitle: updated.title,
        auditName: updated.audit?.name || 'N/A',
        riskRating: updated.riskRating,
        targetDate: updated.targetDate
          ? updated.targetDate.toISOString().split('T')[0]
          : 'N/A',
        description: updated.description || '',
        url: `${process.env.FRONTEND_URL}/observations/${updated.id}`,
      },
    });

    return updated;
  }

  /**
   * Assign reviewer to observation
   */
  static async assignReviewer(
    id: string,
    reviewerId: string,
    assignedById: string
  ): Promise<ObservationWithRelations> {
    const observation = await prisma.observation.findUnique({ where: { id } });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });

    if (!reviewer) {
      throw AppError.badRequest('Invalid reviewer ID');
    }

    const updated = await prisma.observation.update({
      where: { id },
      data: { reviewerId },
      include: observationInclude,
    });

    await this.sendObservationNotification(updated, {
      type: 'OBSERVATION_ASSIGNED',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        observationTitle: updated.title,
        auditName: updated.audit?.name || 'N/A',
        riskRating: updated.riskRating,
        targetDate: updated.targetDate
          ? updated.targetDate.toISOString().split('T')[0]
          : 'N/A',
        description: updated.description || '',
        url: `${process.env.FRONTEND_URL}/observations/${updated.id}`,
      },
    });

    return updated;
  }

  /**
   * Add review cycle comment
   */
  static async addReviewCycle(
    observationId: string,
    period: string,
    comments: string,
    reviewedById: string,
    actionRequired: boolean = false,
    nextReviewDate?: Date
  ) {
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Parse period to extract year and quarter
    const periodMatch = period.match(/Q(\d)\s+(\d{4})/);
    let year = new Date().getFullYear();
    let quarter: number | undefined;

    if (periodMatch) {
      quarter = parseInt(periodMatch[1]);
      year = parseInt(periodMatch[2]);
    }

    // Check if review cycle already exists
    const existing = await prisma.reviewCycle.findUnique({
      where: { observationId_period: { observationId, period } },
    });

    if (existing) {
      // Update existing
      return prisma.reviewCycle.update({
        where: { id: existing.id },
        data: {
          comments,
          actionRequired,
          nextReviewDate,
          reviewedById,
          reviewDate: new Date(),
        },
      });
    }

    // Create new
    return prisma.reviewCycle.create({
      data: {
        observationId,
        period,
        year,
        quarter,
        comments,
        reviewedById,
        actionRequired,
        nextReviewDate,
        reviewDate: new Date(),
      },
    });
  }

  /**
   * Get observations due soon
   */
  static async getObservationsDueSoon(days: number = 7) {
    const now = new Date();
    const futureDate = addDays(now, days);

    return prisma.observation.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED'] },
        targetDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        audit: { select: { id: true, auditNumber: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
      orderBy: { targetDate: 'asc' },
    });
  }

  /**
   * Get overdue observations
   */
  static async getOverdueObservations() {
    return prisma.observation.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED'] },
        targetDate: { lt: new Date() },
      },
      include: {
        audit: { select: { id: true, auditNumber: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
      orderBy: { targetDate: 'asc' },
    });
  }

  /**
   * Bulk update overdue observations
   */
  static async updateOverdueStatus() {
    const overdueObservations = await prisma.observation.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED', 'OVERDUE'] },
        targetDate: { lt: new Date() },
      },
    });

    for (const obs of overdueObservations) {
      await prisma.observation.update({
        where: { id: obs.id },
        data: {
          status: 'OVERDUE',
          previousStatus: obs.status,
          statusChangedAt: new Date(),
        },
      });

      await prisma.observationStatusHistory.create({
        data: {
          observationId: obs.id,
          fromStatus: obs.status,
          toStatus: 'OVERDUE',
          reason: 'Automatically marked as overdue (past target date)',
          changedById: 'SYSTEM',
        },
      });
    }

    return overdueObservations.length;
  }

  /**
   * Delete observation (soft delete)
   */
  static async deleteObservation(id: string): Promise<boolean> {
    const observation = await prisma.observation.findUnique({ where: { id } });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    await prisma.observation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }

  /**
   * Calculate SLA days based on risk rating
   */
  private static async calculateSLA(
    riskRating: RiskRating,
    auditType?: string
  ): Promise<number> {
    // Try to find specific SLA rule
    const slaRule = await prisma.sLARule.findFirst({
      where: {
        isActive: true,
        OR: [
          { riskRating, auditType: auditType as any },
          { riskRating, auditType: null },
          { riskRating: null, auditType: auditType as any },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (slaRule) {
      return slaRule.baseDays;
    }

    // Default SLA based on risk rating
    const defaultSLA: Record<RiskRating, number> = {
      CRITICAL: 14,
      HIGH: 30,
      MEDIUM: 60,
      LOW: 90,
      INFORMATIONAL: 180,
    };

    return defaultSLA[riskRating] || 60;
  }

  /**
   * Validate status transition
   */
  private static validateStatusTransition(
    currentStatus: ObservationStatus,
    newStatus: ObservationStatus
  ): void {
    const validTransitions: Record<ObservationStatus, ObservationStatus[]> = {
      OPEN: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['EVIDENCE_SUBMITTED', 'OPEN', 'CLOSED'],
      EVIDENCE_SUBMITTED: ['UNDER_REVIEW', 'IN_PROGRESS'],
      UNDER_REVIEW: ['CLOSED', 'REJECTED'],
      REJECTED: ['IN_PROGRESS', 'EVIDENCE_SUBMITTED'],
      CLOSED: [], // Cannot transition from CLOSED
      OVERDUE: ['IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'CLOSED'],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private static async sendObservationNotification(
    observation: ObservationWithRelations,
    payload: {
      type: NotificationType;
      channels: NotificationChannel[];
      data: Record<string, unknown>;
    }
  ): Promise<void> {
    const recipients = Array.from(
      new Set(
        [observation.owner?.id, observation.reviewer?.id].filter(
          (id): id is string => Boolean(id)
        )
      )
    );

    if (recipients.length === 0) {
      return;
    }

    for (const userId of recipients) {
      await NotificationService.sendNotification({
        type: payload.type,
        userId,
        observationId: observation.id,
        channels: payload.channels,
        data: payload.data,
      });
    }
  }
}
