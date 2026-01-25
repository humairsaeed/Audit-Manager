import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import {
  AuthenticatedRequest,
  ApiResponse,
  PermissionCheck,
  SYSTEM_ROLES,
} from '../types/index.js';

/**
 * RBAC Middleware Factory
 * Creates middleware that checks if user has required permissions
 */
export const requirePermission = (
  resource: string,
  action: string,
  options?: {
    allowOwner?: boolean;
    ownerField?: string;
    resourceIdParam?: string;
    entityIdParam?: string;
  }
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{ code: 'AUTH_REQUIRED', message: 'You must be logged in' }],
        } as ApiResponse);
        return;
      }

      // System admins have all permissions
      if (user.roles.includes(SYSTEM_ROLES.SYSTEM_ADMIN)) {
        next();
        return;
      }

      // Check for explicit permission
      const hasPermission = await checkUserPermission(user.userId, {
        resource,
        action,
        resourceId: options?.resourceIdParam ? req.params[options.resourceIdParam] : undefined,
        entityId: options?.entityIdParam ? req.params[options.entityIdParam] : undefined,
      });

      if (hasPermission) {
        next();
        return;
      }

      // Check if owner access is allowed and user is the owner
      if (options?.allowOwner && options.resourceIdParam) {
        const resourceId = req.params[options.resourceIdParam];
        const isOwner = await checkResourceOwnership(
          user.userId,
          resource,
          resourceId,
          options.ownerField || 'ownerId'
        );

        if (isOwner) {
          next();
          return;
        }
      }

      logger.warn('Permission denied', {
        userId: user.userId,
        resource,
        action,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        message: 'Permission denied',
        errors: [
          {
            code: 'FORBIDDEN',
            message: `You don't have permission to ${action} ${resource}`,
          },
        ],
      } as ApiResponse);
    } catch (error) {
      logger.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        errors: [{ code: 'AUTH_ERROR', message: 'An error occurred during authorization' }],
      } as ApiResponse);
    }
  };
};

/**
 * Require specific role(s)
 */
export const requireRole = (...roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: [{ code: 'AUTH_REQUIRED', message: 'You must be logged in' }],
      } as ApiResponse);
      return;
    }

    // System admins have access to everything
    if (user.roles.includes(SYSTEM_ROLES.SYSTEM_ADMIN)) {
      next();
      return;
    }

    const hasRole = roles.some((role) => user.roles.includes(role));

    if (hasRole) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Insufficient role',
      errors: [
        {
          code: 'ROLE_REQUIRED',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        },
      ],
    } as ApiResponse);
  };
};

/**
 * Check if user has specific permission
 */
async function checkUserPermission(
  userId: string,
  check: PermissionCheck
): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      entity: true,
    },
  });

  for (const userRole of userRoles) {
    // If role is scoped to a specific entity, check if it matches
    if (userRole.entityId && check.entityId && userRole.entityId !== check.entityId) {
      continue;
    }

    for (const rolePermission of userRole.role.permissions) {
      const permission = rolePermission.permission;

      if (permission.resource !== check.resource) continue;
      if (permission.action !== check.action) continue;

      // Check scope
      switch (permission.scope) {
        case 'all':
          return true;
        case 'entity':
          // Entity-scoped permission requires matching entity
          if (!check.entityId || userRole.entityId === check.entityId) {
            return true;
          }
          break;
        case 'team':
          // Team scope would require additional logic based on your team structure
          // For now, we'll treat it similar to entity scope
          return true;
        case 'own':
          // Own scope is handled by the owner check
          break;
      }
    }
  }

  return false;
}

/**
 * Check if user owns the resource
 */
async function checkResourceOwnership(
  userId: string,
  resource: string,
  resourceId: string,
  ownerField: string
): Promise<boolean> {
  const modelMap: Record<string, string> = {
    observation: 'observation',
    audit: 'audit',
    evidence: 'evidence',
    comment: 'comment',
  };

  const modelName = modelMap[resource.toLowerCase()];
  if (!modelName) return false;

  try {
    // Use dynamic prisma query
    const model = prisma[modelName as keyof typeof prisma] as unknown as {
      findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    };

    if (!model || typeof model.findUnique !== 'function') {
      return false;
    }

    const record = await model.findUnique({
      where: { id: resourceId },
    });

    if (!record) return false;

    return record[ownerField] === userId;
  } catch (error) {
    logger.error('Error checking resource ownership:', error);
    return false;
  }
}

/**
 * Permission decorator for checking multiple permissions (AND logic)
 */
export const requireAllPermissions = (...permissions: Array<[string, string]>) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      } as ApiResponse);
      return;
    }

    if (user.roles.includes(SYSTEM_ROLES.SYSTEM_ADMIN)) {
      next();
      return;
    }

    for (const [resource, action] of permissions) {
      const hasPermission = await checkUserPermission(user.userId, { resource, action });
      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Permission denied',
          errors: [
            {
              code: 'FORBIDDEN',
              message: `Missing required permission: ${action} ${resource}`,
            },
          ],
        } as ApiResponse);
        return;
      }
    }

    next();
  };
};

/**
 * Permission decorator for checking any of multiple permissions (OR logic)
 */
export const requireAnyPermission = (...permissions: Array<[string, string]>) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      } as ApiResponse);
      return;
    }

    if (user.roles.includes(SYSTEM_ROLES.SYSTEM_ADMIN)) {
      next();
      return;
    }

    for (const [resource, action] of permissions) {
      const hasPermission = await checkUserPermission(user.userId, { resource, action });
      if (hasPermission) {
        next();
        return;
      }
    }

    res.status(403).json({
      success: false,
      message: 'Permission denied',
      errors: [
        {
          code: 'FORBIDDEN',
          message: 'You do not have any of the required permissions',
        },
      ],
    } as ApiResponse);
  };
};
