import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { AuthenticatedRequest, JWTPayload, ApiResponse } from '../types/index.js';

/**
 * Authentication middleware
 * Validates JWT token and attaches user info to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: [{ code: 'AUTH_REQUIRED', message: 'No authentication token provided' }],
      } as ApiResponse);
      return;
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Check if session is valid
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: {
        user: {
          include: {
            roles: {
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
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        message: 'Session expired',
        errors: [{ code: 'SESSION_EXPIRED', message: 'Please log in again' }],
      } as ApiResponse);
      return;
    }

    // Check if user is active
    if (session.user.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message: 'Account inactive',
        errors: [{ code: 'ACCOUNT_INACTIVE', message: 'Your account is not active' }],
      } as ApiResponse);
      return;
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    // Extract all permissions
    const permissions = new Set<string>();
    session.user.roles.forEach((userRole) => {
      userRole.role.permissions.forEach((rp) => {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}:${rp.permission.scope}`);
      });
    });

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      userId: session.user.id,
      email: session.user.email,
      roles: session.user.roles.map((ur) => ur.role.name),
      permissions: Array.from(permissions),
      sessionId: session.id,
    };

    (req as AuthenticatedRequest).sessionId = session.id;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expired',
        errors: [{ code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' }],
      } as ApiResponse);
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        errors: [{ code: 'INVALID_TOKEN', message: 'Authentication token is invalid' }],
      } as ApiResponse);
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      errors: [{ code: 'AUTH_ERROR', message: 'An error occurred during authentication' }],
    } as ApiResponse);
  }
};

/**
 * Optional authentication - doesn't fail if no token, just attaches user if present
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    await authenticate(req, res, next);
  } catch {
    next();
  }
};
