import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import logger from '../lib/logger.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuditLogService } from '../middleware/audit-log.middleware.js';
import { NotificationService } from './notification.service.js';
import { TokenPair, JWTPayload, UserWithRoles } from '../types/index.js';

export class AuthService {
  /**
   * Authenticate user and create session
   */
  static async login(
    email: string,
    password: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<{ user: UserWithRoles; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
    });

    if (!user) {
      await AuditLogService.logLogin('unknown', email, false, ipAddress, userAgent);
      throw AppError.unauthorized('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw AppError.unauthorized(
        `Account is locked. Please try again in ${remainingMinutes} minutes`
      );
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      await AuditLogService.logLogin(user.id, email, false, ipAddress, userAgent);
      throw AppError.unauthorized('Account is not active');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockoutUntil?: Date | null } = {
        failedLoginAttempts: newAttempts,
      };

      if (newAttempts >= config.password.maxLoginAttempts) {
        updateData.lockoutUntil = new Date(
          Date.now() + config.password.lockoutDuration * 60000
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await AuditLogService.logLogin(user.id, email, false, ipAddress, userAgent);

      if (updateData.lockoutUntil) {
        throw AppError.unauthorized(
          `Account locked due to too many failed attempts. Try again in ${config.password.lockoutDuration} minutes`
        );
      }

      throw AppError.unauthorized('Invalid email or password');
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + config.session.timeoutMinutes * 60000);

    // Generate tokens
    const tokens = this.generateTokens(user, sessionId);

    // Store session
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    await AuditLogService.logLogin(user.id, email, true, ipAddress, userAgent);

    logger.info(`User logged in: ${email}`);

    return { user: user as UserWithRoles, tokens };
  }

  /**
   * Logout user and invalidate session
   */
  static async logout(
    userId: string,
    sessionId: string,
    ipAddress: string | null
  ): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (session) {
      await prisma.session.delete({ where: { id: sessionId } });
      await AuditLogService.logLogout(
        userId,
        session.user.email,
        sessionId,
        ipAddress
      );
    }
  }

  /**
   * Logout all sessions for a user
   */
  static async logoutAll(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  }

  /**
   * Refresh access token
   */
  static async refreshToken(
    refreshToken: string
  ): Promise<TokenPair> {
    // Verify refresh token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JWTPayload;
    } catch {
      throw AppError.unauthorized('Invalid refresh token');
    }

    // Find session
    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        refreshToken,
      },
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
      throw AppError.unauthorized('Session expired');
    }

    if (session.user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Account is not active');
    }

    // Generate new tokens
    const tokens = this.generateTokens(session.user, session.id);

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + config.session.timeoutMinutes * 60000),
        lastActivityAt: new Date(),
      },
    });

    return tokens;
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw AppError.badRequest('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    // Invalidate all sessions except current
    await prisma.session.deleteMany({
      where: { userId },
    });

    logger.info(`Password changed for user: ${user.email}`);
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Don't reveal if user exists
      return 'If an account with that email exists, a password reset link has been sent';
    }

    const resetToken = this.generatePasswordResetToken(user.id);
    await this.sendPasswordResetEmail(user, resetToken);
    logger.info(`Password reset requested for: ${email}`);

    return resetToken;
  }

  /**
   * Request password reset by admin
   */
  static async requestPasswordResetByAdmin(
    userId: string,
    initiatedBy?: { id: string; email: string }
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User');
    }

    const resetToken = this.generatePasswordResetToken(user.id);
    await this.sendPasswordResetEmail(user, resetToken, initiatedBy?.email);
    logger.info(`Password reset initiated by admin for user: ${user.email}`);
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret) as { userId: string; purpose: string };
    } catch {
      throw AppError.badRequest('Invalid or expired reset token');
    }

    if (decoded.purpose !== 'password_reset') {
      throw AppError.badRequest('Invalid reset token');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: decoded.userId },
    });

    logger.info(`Password reset completed for user: ${decoded.userId}`);
  }

  /**
   * Validate password against policy
   */
  static validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < config.password.minLength) {
      errors.push(`Password must be at least ${config.password.minLength} characters`);
    }

    if (config.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (config.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (config.password.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (config.password.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw AppError.validation('Password does not meet requirements', errors);
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private static generateTokens(user: UserWithRoles, sessionId: string): TokenPair {
    const permissions = new Set<string>();
    user.roles.forEach((userRole) => {
      userRole.role.permissions.forEach((rp) => {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}:${rp.permission.scope}`);
      });
    });

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role.name),
      permissions: Array.from(permissions),
      sessionId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    // Parse expiration
    const expiresIn = this.parseExpiration(config.jwt.expiresIn);

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Parse expiration string to seconds
   */
  private static parseExpiration(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 86400; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 86400;
    }
  }

  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private static generatePasswordResetToken(userId: string): string {
    return jwt.sign(
      { userId, purpose: 'password_reset' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  }

  private static async sendPasswordResetEmail(
    user: { id: string; email: string; firstName: string; lastName: string; displayName?: string | null },
    token: string,
    initiatedBy?: string
  ): Promise<void> {
    const baseUrl =
      process.env.FRONTEND_URL ||
      config.app.corsOrigins[0] ||
      'http://localhost:3000';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const displayName =
      user.displayName ||
      `${user.firstName} ${user.lastName}`.trim() ||
      user.email;

    await NotificationService.sendNotification({
      type: 'PASSWORD_RESET',
      userId: user.id,
      channels: ['EMAIL'],
      data: {
        email: user.email,
        displayName,
        resetUrl,
        initiatedBy,
      },
    });
  }

  /**
   * Get user profile by ID
   */
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Remove sensitive fields
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        displayName: ur.role.displayName,
        entityId: ur.entityId,
        permissions: ur.role.permissions.map((rp) => ({
          resource: rp.permission.resource,
          action: rp.permission.action,
          scope: rp.permission.scope,
        })),
      })),
    };
  }
}
