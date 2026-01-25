import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthService } from './auth.service.js';
import { AuditLogService } from '../middleware/audit-log.middleware.js';
import {
  CreateUserDTO,
  UpdateUserDTO,
  PaginationParams,
  PaginatedResponse,
} from '../types/index.js';

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserDTO,
    createdById: string,
    ipAddress: string | null
  ) {
    // Validate password
    AuthService.validatePassword(data.password);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw AppError.conflict('A user with this email already exists');
    }

    // Check if employeeId already exists
    if (data.employeeId) {
      const existingEmployee = await prisma.user.findUnique({
        where: { employeeId: data.employeeId },
      });

      if (existingEmployee) {
        throw AppError.conflict('A user with this employee ID already exists');
      }
    }

    // Verify all role IDs exist
    const roles = await prisma.role.findMany({
      where: { id: { in: data.roleIds } },
    });

    if (roles.length !== data.roleIds.length) {
      throw AppError.badRequest('One or more role IDs are invalid');
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(data.password);

    // Create user with roles
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        employeeId: data.employeeId,
        department: data.department,
        title: data.title,
        phone: data.phone,
        status: 'PENDING_ACTIVATION',
        createdById,
        roles: {
          create: data.roleIds.map((roleId) => ({
            roleId,
            assignedBy: createdById,
          })),
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Log permission grant
    await AuditLogService.logPermissionChange(
      createdById,
      '', // Would need to fetch creator email
      user.id,
      user.email,
      'GRANTED',
      roles.map((r) => r.name),
      ipAddress
    );

    return user;
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
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
            entity: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    return user;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    return user;
  }

  /**
   * List users with pagination and filtering
   */
  static async listUsers(
    params: PaginationParams,
    filters?: {
      search?: string;
      status?: UserStatus;
      roleId?: string;
      department?: string;
    }
  ): Promise<PaginatedResponse<Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { employeeId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.department) {
      where.department = filters.department;
    }

    if (filters?.roleId) {
      where.roles = {
        some: { roleId: filters.roleId },
      };
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
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
   * Update user
   */
  static async updateUser(id: string, data: UpdateUserDTO) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.firstName && data.lastName
          ? `${data.firstName} ${data.lastName}`
          : undefined,
        department: data.department,
        title: data.title,
        phone: data.phone,
        status: data.status,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Activate user
   */
  static async activateUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    return prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Logout all sessions
    await AuthService.logoutAll(id);

    return prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  /**
   * Lock user account
   */
  static async lockUser(id: string, durationMinutes: number) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Logout all sessions
    await AuthService.logoutAll(id);

    return prisma.user.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockoutUntil: new Date(Date.now() + durationMinutes * 60000),
      },
    });
  }

  /**
   * Unlock user account
   */
  static async unlockUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    return prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        lockoutUntil: null,
        failedLoginAttempts: 0,
      },
    });
  }

  /**
   * Assign roles to user
   */
  static async assignRoles(
    userId: string,
    roleIds: string[],
    assignedById: string,
    entityId?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Verify roles exist
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      throw AppError.badRequest('One or more role IDs are invalid');
    }

    // Create role assignments
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
        entityId,
        assignedBy: assignedById,
      })),
      skipDuplicates: true,
    });

    return this.getUserById(userId);
  }

  /**
   * Remove roles from user
   */
  static async removeRoles(
    userId: string,
    roleIds: string[],
    entityId?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw AppError.notFound('User');
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: { in: roleIds },
        entityId: entityId || null,
      },
    });

    return this.getUserById(userId);
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Logout all sessions
    await AuthService.logoutAll(id);

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(roleName: string) {
    return prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: {
            role: {
              name: roleName,
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Search users for assignment dropdown
   */
  static async searchUsers(query: string, limit = 10) {
    return prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { employeeId: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        department: true,
        title: true,
      },
      take: limit,
      orderBy: { displayName: 'asc' },
    });
  }
}
