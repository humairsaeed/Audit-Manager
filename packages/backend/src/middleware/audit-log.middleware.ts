import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLogger } from '../lib/logger.js';
import { AuthenticatedRequest, ActionType } from '../types/index.js';

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

      createAuditLog(
        user?.userId || null,
        user?.email || null,
        action,
        resource,
        resourceId,
        generateDescription(req.method, resource, resourceId),
        null, // Previous value would need to be captured before the operation
        req.body,
        getClientIp(req),
        req.headers['user-agent'] || null,
        user?.sessionId || null
      );
    }

    return originalJson(body);
  };

  next();
};

/**
 * Extract resource name from path
 */
function extractResource(path: string): string {
  // Remove API prefix and version
  const cleanPath = path.replace(/^\/api\/v\d+\//, '');
  // Get first segment
  const parts = cleanPath.split('/').filter(Boolean);
  return parts[0] || 'unknown';
}

/**
 * Extract resource ID from path
 */
function extractResourceId(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  // Look for UUID-like patterns
  for (const part of parts) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
      return part;
    }
  }
  return null;
}

/**
 * Generate human-readable description
 */
function generateDescription(method: string, resource: string, resourceId: string | null): string {
  const action = method === 'POST' ? 'Created' : method === 'DELETE' ? 'Deleted' : 'Updated';
  const target = resourceId ? `${resource} (${resourceId})` : resource;
  return `${action} ${target}`;
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
    await createAuditLog(
      userId,
      email,
      'STATUS_CHANGE',
      resource,
      resourceId,
      `Changed ${resource} status from ${previousStatus} to ${newStatus}`,
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
    await createAuditLog(
      userId,
      email,
      'ASSIGNMENT',
      resource,
      resourceId,
      `Assigned ${resource} to ${assigneeName}`,
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
    await createAuditLog(
      userId,
      email,
      'EVIDENCE_UPLOAD',
      'evidence',
      evidenceId,
      `Uploaded evidence "${fileName}" for observation ${observationId}`,
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
    await createAuditLog(
      userId,
      email,
      'IMPORT',
      'import_job',
      importJobId,
      `Imported ${rowCount} observations from "${fileName}" to audit ${auditId}`,
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
