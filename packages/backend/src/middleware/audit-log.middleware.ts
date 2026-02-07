import { Request, Response, NextFunction } from 'express';
import { ActionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { auditLogger } from '../lib/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Maps HTTP methods to action types
 */
const methodToAction: Record<string, ActionType> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Creates audit log entry for API requests
 */
export const createAuditLog = async (
  userId: string | null,
  userEmail: string | null,
  action: ActionType,
  resource: string,
  resourceId: string | null,
  description: string,
  previousValue: unknown = null,
  newValue: unknown = null,
  ipAddress: string | null = null,
  userAgent: string | null = null,
  sessionId: string | null = null
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        description,
        previousValue: previousValue ? JSON.parse(JSON.stringify(previousValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress,
        userAgent,
        sessionId,
      },
    });

    // Also log to file
    auditLogger.info(description, {
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      ipAddress,
    });
  } catch (error) {
    auditLogger.error('Failed to create audit log', { error, userId, action, resource });
  }
};

/**
 * Middleware to automatically log API requests that modify data
 */
export const auditLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only log modifying operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  // Skip AI/insights routes - these are not user actions worth logging
  if (/\/ai\/|\/insights/i.test(req.path)) {
    next();
    return;
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to capture response
  res.json = function (body: unknown): Response {
    // Log the action after successful response
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const user = (req as AuthenticatedRequest).user;
      const action = methodToAction[req.method] || 'UPDATE';
      const resource = extractResource(req.path);
      const resourceId = extractResourceId(req.path);

      // Generate description with resource name lookup and changed fields
      generateDescriptionAsync(req.method, req.path, body, req.body).then((description) => {
        createAuditLog(
          user?.userId || null,
          user?.email || null,
          action,
          resource,
          resourceId,
          description,
          null, // Previous value would need to be captured before the operation
          req.body,
          getClientIp(req),
          req.headers['user-agent'] || null,
          user?.sessionId || null
        );
      });
    }

    return originalJson(body);
  };

  next();
};

/**
 * Parse path to extract resource info including nested resources
 */
interface PathInfo {
  parentResource: string;
  parentId: string | null;
  subResource: string | null;
  subResourceId: string | null;
}

function parsePath(path: string): PathInfo {
  // Remove API prefix and version
  const cleanPath = path.replace(/^\/api\/v\d+\//, '');
  const parts = cleanPath.split('/').filter(Boolean);

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const result: PathInfo = {
    parentResource: parts[0] || 'unknown',
    parentId: null,
    subResource: null,
    subResourceId: null,
  };

  // Parse: /resource/:id/subResource/:subId
  if (parts.length >= 2 && isUUID(parts[1])) {
    result.parentId = parts[1];
  }

  if (parts.length >= 3 && !isUUID(parts[2])) {
    result.subResource = parts[2];
  }

  if (parts.length >= 4 && isUUID(parts[3])) {
    result.subResourceId = parts[3];
  }

  return result;
}

/**
 * Extract resource name from path (for backward compatibility)
 */
function extractResource(path: string): string {
  const info = parsePath(path);
  return info.subResource || info.parentResource;
}

/**
 * Extract resource ID from path (for backward compatibility)
 */
function extractResourceId(path: string): string | null {
  const info = parsePath(path);
  return info.subResourceId || info.parentId;
}

/**
 * Look up observation title by ID
 */
async function getObservationTitle(id: string): Promise<string | null> {
  try {
    const observation = await prisma.observation.findUnique({
      where: { id },
      select: { title: true },
    });
    return observation?.title || null;
  } catch {
    return null;
  }
}

/**
 * Look up audit name by ID
 */
async function getAuditName(id: string): Promise<string | null> {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { name: true },
    });
    return audit?.name || null;
  } catch {
    return null;
  }
}

/**
 * Look up user name by ID
 */
async function getUserName(id: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, firstName: true, lastName: true },
    });
    return user ? `${user.firstName} ${user.lastName}`.trim() || user.email : null;
  } catch {
    return null;
  }
}

/**
 * Generate human-readable description with async resource name lookup
 */
/**
 * Maps request body field names to human-readable labels
 */
const fieldLabels: Record<string, string> = {
  managementResponse: 'management response',
  correctiveActionPlan: 'corrective action plan',
  description: 'description',
  title: 'title',
  riskRating: 'risk rating',
  rootCause: 'root cause',
  impact: 'impact',
  recommendation: 'recommendation',
  responsiblePartyText: 'responsible party',
  ownerId: 'owner',
  reviewerId: 'reviewer',
  targetDate: 'target date',
  extensionReason: 'extension reason',
  tags: 'tags',
  status: 'status',
  findingClassification: 'finding classification',
  controlDomainArea: 'control domain area',
  controlClauseRef: 'control clause reference',
  controlRequirement: 'control requirement',
  externalReference: 'external reference',
  name: 'name',
  scope: 'scope',
  objectives: 'objectives',
  periodStart: 'period start',
  periodEnd: 'period end',
  executiveSummary: 'executive summary',
  riskAssessment: 'risk assessment',
};

/**
 * Get human-readable list of changed fields from request body
 */
function getChangedFieldsList(requestBody: unknown): string | null {
  if (!requestBody || typeof requestBody !== 'object') return null;

  const body = requestBody as Record<string, unknown>;
  const changedFields: string[] = [];

  for (const key of Object.keys(body)) {
    if (fieldLabels[key]) {
      changedFields.push(fieldLabels[key]);
    }
  }

  if (changedFields.length === 0) return null;
  if (changedFields.length === 1) return changedFields[0];
  if (changedFields.length <= 3) return changedFields.join(', ');
  return `${changedFields.slice(0, 3).join(', ')} and ${changedFields.length - 3} more`;
}

async function generateDescriptionAsync(
  method: string,
  path: string,
  responseBody: unknown,
  requestBody?: unknown
): Promise<string> {
  const pathInfo = parsePath(path);
  const body = responseBody as any;

  // Get the name/title from response body if available
  const responseTitle = body?.data?.title || body?.data?.name || body?.data?.fileName || null;

  // Handle nested resources (e.g., /observations/:id/evidence)
  if (pathInfo.subResource && pathInfo.parentId) {
    const parentName = await getParentResourceName(pathInfo.parentResource, pathInfo.parentId);
    const parentDisplay = parentName ? `"${parentName}"` : pathInfo.parentId;

    switch (pathInfo.subResource) {
      case 'evidence':
        if (method === 'POST') {
          const fileName = body?.data?.fileName || body?.data?.originalName || 'file';
          return `Uploaded evidence "${fileName}" to observation ${parentDisplay}`;
        } else if (method === 'DELETE') {
          return `Deleted evidence from observation ${parentDisplay}`;
        }
        break;

      case 'comments':
        if (method === 'POST') {
          return `Added comment to observation ${parentDisplay}`;
        } else if (method === 'DELETE') {
          return `Deleted comment from observation ${parentDisplay}`;
        }
        break;

      case 'status':
        const newStatus = body?.data?.status || body?.status;
        if (newStatus) {
          return `Changed status of observation ${parentDisplay} to ${newStatus}`;
        }
        return `Updated status of observation ${parentDisplay}`;

      case 'follow-up':
        return `Added follow-up to observation ${parentDisplay}`;

      case 'review-cycle':
        return `Added review cycle to observation ${parentDisplay}`;

      case 'team':
        if (method === 'POST') {
          const memberName = body?.data?.user?.firstName
            ? `${body.data.user.firstName} ${body.data.user.lastName}`.trim()
            : null;
          return memberName
            ? `Added ${memberName} to audit team for ${parentDisplay}`
            : `Added team member to audit ${parentDisplay}`;
        } else if (method === 'DELETE') {
          return `Removed team member from audit ${parentDisplay}`;
        }
        break;

      case 'documents':
        if (method === 'POST') {
          const docName = body?.data?.name || body?.data?.fileName || 'document';
          return `Uploaded document "${docName}" to audit ${parentDisplay}`;
        } else if (method === 'DELETE') {
          return `Deleted document from audit ${parentDisplay}`;
        }
        break;
    }

    // Generic fallback for nested resources
    const action = method === 'POST' ? 'Added' : method === 'DELETE' ? 'Removed' : 'Updated';
    return `${action} ${pathInfo.subResource} for ${pathInfo.parentResource.slice(0, -1)} ${parentDisplay}`;
  }

  // Handle top-level resources
  const action = method === 'POST' ? 'Created' : method === 'DELETE' ? 'Deleted' : 'Updated';
  const resourceSingular = pathInfo.parentResource.replace(/s$/, '');

  // Try to get resource name
  let resourceName = responseTitle;

  if (!resourceName && pathInfo.parentId) {
    resourceName = await getParentResourceName(pathInfo.parentResource, pathInfo.parentId);
  }

  const nameDisplay = resourceName ? `"${resourceName}"` : pathInfo.parentId ? `(${pathInfo.parentId.substring(0, 8)}...)` : '';

  // For updates, show which fields were changed
  if ((method === 'PUT' || method === 'PATCH') && requestBody) {
    const changedFields = getChangedFieldsList(requestBody);
    if (changedFields) {
      return `Updated ${changedFields} for ${resourceSingular} ${nameDisplay}`.trim();
    }
  }

  return `${action} ${resourceSingular} ${nameDisplay}`.trim();
}

/**
 * Get parent resource name based on type
 */
async function getParentResourceName(resource: string, id: string): Promise<string | null> {
  switch (resource) {
    case 'observations':
      return getObservationTitle(id);
    case 'audits':
      return getAuditName(id);
    case 'users':
      return getUserName(id);
    default:
      return null;
  }
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.socket.remoteAddress || null;
}

/**
 * Helper to log specific actions with context
 */
export class AuditLogService {
  static async logLogin(
    userId: string,
    email: string,
    success: boolean,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await createAuditLog(
      userId,
      email,
      'LOGIN',
      'session',
      null,
      success ? `User ${email} logged in successfully` : `Failed login attempt for ${email}`,
      null,
      { success },
      ipAddress,
      userAgent,
      null
    );
  }

  static async logLogout(
    userId: string,
    email: string,
    sessionId: string,
    ipAddress: string | null
  ): Promise<void> {
    await createAuditLog(
      userId,
      email,
      'LOGOUT',
      'session',
      sessionId,
      `User ${email} logged out`,
      null,
      null,
      ipAddress,
      null,
      sessionId
    );
  }

  static async logStatusChange(
    userId: string,
    email: string,
    resource: string,
    resourceId: string,
    previousStatus: string,
    newStatus: string,
    ipAddress: string | null
  ): Promise<void> {
    const resourceName = await getParentResourceName(resource + 's', resourceId);
    const resourceDisplay = resourceName ? `"${resourceName}"` : resourceId;

    await createAuditLog(
      userId,
      email,
      'STATUS_CHANGE',
      resource,
      resourceId,
      `Changed ${resource} ${resourceDisplay} status from ${previousStatus} to ${newStatus}`,
      { status: previousStatus },
      { status: newStatus },
      ipAddress,
      null,
      null
    );
  }

  static async logAssignment(
    userId: string,
    email: string,
    resource: string,
    resourceId: string,
    assigneeId: string,
    assigneeName: string,
    ipAddress: string | null
  ): Promise<void> {
    const resourceName = await getParentResourceName(resource + 's', resourceId);
    const resourceDisplay = resourceName ? `"${resourceName}"` : resourceId;

    await createAuditLog(
      userId,
      email,
      'ASSIGNMENT',
      resource,
      resourceId,
      `Assigned ${resource} ${resourceDisplay} to ${assigneeName}`,
      null,
      { assigneeId, assigneeName },
      ipAddress,
      null,
      null
    );
  }

  static async logEvidenceUpload(
    userId: string,
    email: string,
    observationId: string,
    evidenceId: string,
    fileName: string,
    ipAddress: string | null
  ): Promise<void> {
    const observationTitle = await getObservationTitle(observationId);
    const obsDisplay = observationTitle ? `"${observationTitle}"` : observationId;

    await createAuditLog(
      userId,
      email,
      'EVIDENCE_UPLOAD',
      'evidence',
      evidenceId,
      `Uploaded evidence "${fileName}" to observation ${obsDisplay}`,
      null,
      { fileName, observationId },
      ipAddress,
      null,
      null
    );
  }

  static async logImport(
    userId: string,
    email: string,
    auditId: string,
    importJobId: string,
    fileName: string,
    rowCount: number,
    ipAddress: string | null
  ): Promise<void> {
    const auditName = await getAuditName(auditId);
    const auditDisplay = auditName ? `"${auditName}"` : auditId;

    await createAuditLog(
      userId,
      email,
      'IMPORT',
      'import_job',
      importJobId,
      `Imported ${rowCount} observations from "${fileName}" to audit ${auditDisplay}`,
      null,
      { fileName, rowCount, auditId },
      ipAddress,
      null,
      null
    );
  }

  static async logExport(
    userId: string,
    email: string,
    resource: string,
    filters: Record<string, unknown>,
    format: string,
    ipAddress: string | null
  ): Promise<void> {
    await createAuditLog(
      userId,
      email,
      'EXPORT',
      resource,
      null,
      `Exported ${resource} report in ${format} format`,
      null,
      { filters, format },
      ipAddress,
      null,
      null
    );
  }

  static async logPermissionChange(
    userId: string,
    email: string,
    targetUserId: string,
    targetUserEmail: string,
    action: 'GRANTED' | 'REVOKED',
    roles: string[],
    ipAddress: string | null
  ): Promise<void> {
    await createAuditLog(
      userId,
      email,
      'PERMISSION_CHANGE',
      'user_role',
      targetUserId,
      `${action === 'GRANTED' ? 'Granted' : 'Revoked'} roles [${roles.join(', ')}] for user ${targetUserEmail}`,
      null,
      { targetUserId, targetUserEmail, action, roles },
      ipAddress,
      null,
      null
    );
  }
}
