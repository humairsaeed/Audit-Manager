import { Request } from 'express';
import { User, Role, Permission } from '@prisma/client';

// ============================================================================
// Authentication Types
// ============================================================================

export interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================================================
// User Types
// ============================================================================

export interface UserWithRoles extends User {
  roles: Array<{
    role: Role & {
      permissions: Array<{
        permission: Permission;
      }>;
    };
    entityId: string | null;
  }>;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  department?: string;
  title?: string;
  phone?: string;
  roleIds: string[];
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  department?: string;
  title?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
}

// ============================================================================
// Audit Types
// ============================================================================

export interface CreateAuditDTO {
  name: string;
  description?: string;
  type: AuditType;
  entityId: string;
  scope?: string;
  objectives?: string;
  periodStart: Date;
  periodEnd: Date;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  leadAuditorId?: string;
  externalAuditorName?: string;
  externalAuditorFirm?: string;
  teamMemberIds?: string[];
}

export interface UpdateAuditDTO {
  name?: string;
  description?: string;
  scope?: string;
  objectives?: string;
  periodStart?: Date;
  periodEnd?: Date;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status?: AuditStatus;
  leadAuditorId?: string;
  externalAuditorName?: string;
  externalAuditorFirm?: string;
  riskAssessment?: string;
  executiveSummary?: string;
}

export type AuditType =
  | 'INTERNAL'
  | 'EXTERNAL'
  | 'ISO'
  | 'SOC'
  | 'ISR'
  | 'FINANCIAL'
  | 'IT'
  | 'REGULATORY'
  | 'CUSTOM';

export type AuditStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'UNDER_REVIEW'
  | 'CLOSED'
  | 'CANCELLED';

// ============================================================================
// Observation Types
// ============================================================================

export interface CreateObservationDTO {
  auditId: string;
  externalReference?: string;
  auditSource?: string;
  entityId?: string;
  controlDomainArea?: string;
  controlId?: string;
  controlClauseRef?: string;
  controlRequirement?: string;
  title: string;
  description: string;
  findingClassification?: string;
  riskRating: RiskRating;
  rootCause?: string;
  impact?: string;
  recommendation?: string;
  responsiblePartyText?: string;
  ownerId?: string;
  reviewerId?: string;
  correctiveActionPlan?: string;
  managementResponse?: string;
  openDate: Date;
  targetDate: Date;
  tags?: string[];
}

export interface UpdateObservationDTO {
  externalReference?: string;
  entityId?: string;
  controlDomainArea?: string;
  controlId?: string;
  controlClauseRef?: string;
  controlRequirement?: string;
  title?: string;
  description?: string;
  findingClassification?: string;
  riskRating?: RiskRating;
  rootCause?: string;
  impact?: string;
  recommendation?: string;
  responsiblePartyText?: string;
  ownerId?: string;
  reviewerId?: string;
  correctiveActionPlan?: string;
  managementResponse?: string;
  targetDate?: Date;
  extensionReason?: string;
  tags?: string[];
}

export type RiskRating = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type ObservationStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'EVIDENCE_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'CLOSED'
  | 'OVERDUE';

// ============================================================================
// Evidence Types
// ============================================================================

export interface CreateEvidenceDTO {
  observationId: string;
  name: string;
  description?: string;
  file: Express.Multer.File;
}

export interface ReviewEvidenceDTO {
  status: 'APPROVED' | 'REJECTED';
  reviewRemarks?: string;
  rejectionReason?: string;
}

export type EvidenceStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

// ============================================================================
// Import Types
// ============================================================================

export interface ColumnMapping {
  excelColumn: string;
  systemField: string;
  transformation?: string;
  required: boolean;
}

export interface ImportConfig {
  mappings: ColumnMapping[];
  skipRows?: number;
  dateFormat?: string;
  defaultValues?: Record<string, unknown>;
}

export interface ImportValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
  preview: Record<string, unknown>[];
}

export interface ImportRowError {
  row: number;
  column?: string;
  field?: string;
  value?: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportRowWarning {
  row: number;
  column?: string;
  message: string;
}

export interface ImportProgress {
  jobId: string;
  status: ImportStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  currentRow?: number;
  errors?: ImportRowError[];
}

export type ImportStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK';

// ============================================================================
// Dashboard & Reporting Types
// ============================================================================

export interface DashboardStats {
  totalObservations: number;
  openObservations: number;
  overdueObservations: number;
  closedThisMonth: number;
  byStatus: Record<ObservationStatus, number>;
  byRiskRating: Record<RiskRating, number>;
  byEntity: Array<{ entity: string; count: number }>;
  slaCompliance: number;
  agingAnalysis: AgingBucket[];
  recentActivity: ActivityItem[];
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
  resourceId?: string;
  resourceType?: string;
}

export interface ReportFilters {
  auditIds?: string[];
  auditType?: AuditType;
  entityIds?: string[];
  riskRatings?: RiskRating[];
  statuses?: ObservationStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  ownerId?: string;
  overdueOnly?: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType =
  | 'PASSWORD_RESET'
  | 'FOLLOW_UP'
  | 'OBSERVATION_ASSIGNED'
  | 'OBSERVATION_UPDATED'
  | 'DUE_DATE_REMINDER'
  | 'OVERDUE_ALERT'
  | 'EVIDENCE_SUBMITTED'
  | 'EVIDENCE_REJECTED'
  | 'EVIDENCE_APPROVED'
  | 'OBSERVATION_CLOSED'
  | 'REVIEW_REQUIRED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED';

export type NotificationChannel = 'EMAIL' | 'TEAMS' | 'IN_APP';

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  observationId?: string;
  channels: NotificationChannel[];
  data: Record<string, unknown>;
}

// ============================================================================
// Pagination & Query Types
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryFilters {
  search?: string;
  status?: string | string[];
  riskRating?: string | string[];
  entityId?: string;
  auditId?: string;
  ownerId?: string;
  reviewerId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdueOnly?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}

// ============================================================================
// RBAC Types
// ============================================================================

export interface PermissionCheck {
  resource: string;
  action: string;
  scope?: 'own' | 'team' | 'entity' | 'all';
  resourceId?: string;
  entityId?: string;
}

export const SYSTEM_ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  AUDIT_ADMIN: 'audit_admin',
  COMPLIANCE_MANAGER: 'compliance_manager',
  AUDITOR: 'auditor',
  OBSERVATION_OWNER: 'observation_owner',
  REVIEWER: 'reviewer',
  EXECUTIVE: 'executive',
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

export const RESOURCES = {
  AUDIT: 'audit',
  OBSERVATION: 'observation',
  EVIDENCE: 'evidence',
  USER: 'user',
  ROLE: 'role',
  ENTITY: 'entity',
  IMPORT: 'import',
  REPORT: 'report',
  DASHBOARD: 'dashboard',
  SYSTEM_CONFIG: 'system_config',
} as const;

export type Resource = typeof RESOURCES[keyof typeof RESOURCES];

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  ASSIGN: 'assign',
  IMPORT: 'import',
  EXPORT: 'export',
} as const;

export type Action = typeof ACTIONS[keyof typeof ACTIONS];

// ActionType is exported from Prisma - use import { ActionType } from '@prisma/client'

// ============================================================================
// AI Observation Intelligence Types (re-export)
// ============================================================================
export * from './ai-observation.types.js';
