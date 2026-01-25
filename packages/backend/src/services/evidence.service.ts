import { EvidenceStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuditLogService } from '../middleware/audit-log.middleware.js';
import { StorageService } from './storage.service.js';
import { ObservationService } from './observation.service.js';
import { ReviewEvidenceDTO } from '../types/index.js';

export class EvidenceService {
  /**
   * Upload evidence for an observation
   */
  static async uploadEvidence(
    observationId: string,
    file: Express.Multer.File,
    name: string,
    description: string | undefined,
    uploadedById: string,
    ipAddress: string | null
  ) {
    // Verify observation exists
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Check if observation is in a valid state for evidence upload
    const validStates = ['OPEN', 'IN_PROGRESS', 'REJECTED', 'OVERDUE'];
    if (!validStates.includes(observation.status)) {
      throw AppError.badRequest(
        `Cannot upload evidence when observation status is ${observation.status}`
      );
    }

    // Calculate file checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicate file
    const existingEvidence = await prisma.evidence.findFirst({
      where: {
        observationId,
        checksum,
        deletedAt: null,
        status: { not: 'SUPERSEDED' },
      },
    });

    if (existingEvidence) {
      throw AppError.conflict('This file has already been uploaded as evidence');
    }

    // Get current version number
    const lastEvidence = await prisma.evidence.findFirst({
      where: { observationId },
      orderBy: { version: 'desc' },
    });
    const version = (lastEvidence?.version || 0) + 1;

    // Upload file to storage
    const filePath = await StorageService.uploadFile(
      file,
      `observations/${observationId}/evidence`
    );

    // Create evidence record
    const evidence = await prisma.evidence.create({
      data: {
        observationId,
        version,
        name,
        description,
        filePath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        checksum,
        status: 'PENDING_REVIEW',
        uploadedById,
      },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log evidence upload
    const user = await prisma.user.findUnique({ where: { id: uploadedById } });
    await AuditLogService.logEvidenceUpload(
      uploadedById,
      user?.email || '',
      observationId,
      evidence.id,
      file.originalname,
      ipAddress
    );

    // Update observation status if it was in OPEN status
    if (observation.status === 'OPEN') {
      await ObservationService.updateStatus(
        observationId,
        'IN_PROGRESS',
        uploadedById,
        'Evidence upload started'
      );
    }

    return evidence;
  }

  /**
   * Get evidence by ID
   */
  static async getEvidenceById(id: string) {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        observation: {
          select: { id: true, globalSequence: true, title: true, auditId: true },
        },
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence');
    }

    return evidence;
  }

  /**
   * List evidence for an observation
   */
  static async listEvidence(
    observationId: string,
    includeSuperseded: boolean = false
  ) {
    const where: { observationId: string; deletedAt: null; status?: { not: EvidenceStatus } } = {
      observationId,
      deletedAt: null,
    };

    if (!includeSuperseded) {
      where.status = { not: 'SUPERSEDED' };
    }

    return prisma.evidence.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Review evidence (approve or reject)
   */
  static async reviewEvidence(
    id: string,
    review: ReviewEvidenceDTO,
    reviewedById: string
  ) {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: { observation: true },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence');
    }

    if (evidence.status !== 'PENDING_REVIEW') {
      throw AppError.badRequest('Evidence is not pending review');
    }

    // Update evidence status
    const updated = await prisma.evidence.update({
      where: { id },
      data: {
        status: review.status,
        reviewedById,
        reviewedAt: new Date(),
        reviewRemarks: review.reviewRemarks,
        rejectionReason: review.status === 'REJECTED' ? review.rejectionReason : null,
      },
      include: {
        observation: true,
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Update observation status based on review result
    if (review.status === 'REJECTED') {
      await ObservationService.updateStatus(
        evidence.observationId,
        'REJECTED',
        reviewedById,
        `Evidence rejected: ${review.rejectionReason}`
      );
    }

    return updated;
  }

  /**
   * Submit evidence for review (changes observation status)
   */
  static async submitForReview(observationId: string, submittedById: string) {
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
      include: {
        audit: {
          select: { name: true },
        },
        evidence: {
          where: {
            deletedAt: null,
            status: { not: 'SUPERSEDED' },
          },
        },
      },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Check if there's at least one evidence
    if (observation.evidence.length === 0) {
      throw AppError.badRequest('At least one evidence must be uploaded before submitting for review');
    }

    // Check if all evidence is either pending or approved
    const hasRejected = observation.evidence.some((e) => e.status === 'REJECTED');
    if (hasRejected) {
      throw AppError.badRequest('Cannot submit for review while there is rejected evidence');
    }

    // Update observation status
    await ObservationService.updateStatus(
      observationId,
      'EVIDENCE_SUBMITTED',
      submittedById,
      'Evidence submitted for review'
    );

    return observation;
  }

  /**
   * Approve all evidence and close observation
   */
  static async approveAndClose(
    observationId: string,
    reviewedById: string,
    remarks?: string
  ) {
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
      include: {
        evidence: {
          where: {
            deletedAt: null,
            status: 'PENDING_REVIEW',
          },
        },
      },
    });

    if (!observation) {
      throw AppError.notFound('Observation');
    }

    // Approve all pending evidence
    await prisma.evidence.updateMany({
      where: {
        observationId,
        status: 'PENDING_REVIEW',
        deletedAt: null,
      },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
        reviewRemarks: remarks,
      },
    });

    // Close the observation
    await ObservationService.updateStatus(
      observationId,
      'CLOSED',
      reviewedById,
      'All evidence approved, observation closed'
    );

    return prisma.observation.findUnique({
      where: { id: observationId },
      include: {
        evidence: { where: { deletedAt: null } },
      },
    });
  }

  /**
   * Get signed URL for evidence download
   */
  static async getDownloadUrl(id: string, userId: string) {
    const evidence = await this.getEvidenceById(id);

    // Generate signed URL
    const url = await StorageService.getSignedUrl(evidence.filePath, 3600); // 1 hour

    return { url, fileName: evidence.fileName, mimeType: evidence.mimeType };
  }

  /**
   * Delete evidence (soft delete)
   */
  static async deleteEvidence(id: string, deletedById: string) {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: { observation: true },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence');
    }

    // Check if observation allows deletion
    if (evidence.observation.status === 'CLOSED') {
      throw AppError.badRequest('Cannot delete evidence from a closed observation');
    }

    // Soft delete evidence
    await prisma.evidence.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Do not delete the actual file - keep for audit purposes

    return true;
  }

  /**
   * Supersede evidence with new version
   */
  static async supersedeEvidence(
    id: string,
    file: Express.Multer.File,
    name: string,
    description: string | undefined,
    uploadedById: string,
    ipAddress: string | null
  ) {
    const oldEvidence = await prisma.evidence.findUnique({
      where: { id },
    });

    if (!oldEvidence) {
      throw AppError.notFound('Evidence');
    }

    // Mark old evidence as superseded
    await prisma.evidence.update({
      where: { id },
      data: { status: 'SUPERSEDED' },
    });

    // Upload new evidence with link to superseded
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const filePath = await StorageService.uploadFile(
      file,
      `observations/${oldEvidence.observationId}/evidence`
    );

    const newEvidence = await prisma.evidence.create({
      data: {
        observationId: oldEvidence.observationId,
        version: oldEvidence.version + 1,
        name,
        description,
        filePath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        checksum,
        status: 'PENDING_REVIEW',
        uploadedById,
        supersededById: id,
      },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log evidence upload
    const user = await prisma.user.findUnique({ where: { id: uploadedById } });
    await AuditLogService.logEvidenceUpload(
      uploadedById,
      user?.email || '',
      oldEvidence.observationId,
      newEvidence.id,
      file.originalname,
      ipAddress
    );

    return newEvidence;
  }

  /**
   * Get evidence statistics for an observation
   */
  static async getEvidenceStats(observationId: string) {
    const evidence = await prisma.evidence.findMany({
      where: {
        observationId,
        deletedAt: null,
      },
    });

    const stats = {
      total: evidence.length,
      pending: evidence.filter((e) => e.status === 'PENDING_REVIEW').length,
      approved: evidence.filter((e) => e.status === 'APPROVED').length,
      rejected: evidence.filter((e) => e.status === 'REJECTED').length,
      superseded: evidence.filter((e) => e.status === 'SUPERSEDED').length,
      totalSize: evidence.reduce((sum, e) => sum + e.fileSize, 0),
    };

    return stats;
  }
}
