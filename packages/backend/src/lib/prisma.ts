import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.app.isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  });

if (!config.app.isProduction) {
  globalForPrisma.prisma = prisma;
}

// Middleware for soft deletes
prisma.$use(async (params, next) => {
  // Soft delete - convert delete to update
  if (params.action === 'delete') {
    const modelsWithSoftDelete = ['User', 'Audit', 'Observation', 'Evidence', 'Comment', 'AuditDocument'];

    if (modelsWithSoftDelete.includes(params.model || '')) {
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }
  }

  // Soft delete - convert deleteMany to updateMany
  if (params.action === 'deleteMany') {
    const modelsWithSoftDelete = ['User', 'Audit', 'Observation', 'Evidence', 'Comment', 'AuditDocument'];

    if (modelsWithSoftDelete.includes(params.model || '')) {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
    }
  }

  // Filter out soft deleted records for find operations
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    const modelsWithSoftDelete = ['User', 'Audit', 'Observation', 'Evidence', 'Comment', 'AuditDocument'];

    if (modelsWithSoftDelete.includes(params.model || '')) {
      params.action = 'findFirst';
      params.args.where = {
        ...params.args.where,
        deletedAt: null,
      };
    }
  }

  if (params.action === 'findMany') {
    const modelsWithSoftDelete = ['User', 'Audit', 'Observation', 'Evidence', 'Comment', 'AuditDocument'];

    if (modelsWithSoftDelete.includes(params.model || '')) {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where['deletedAt'] = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }
  }

  return next(params);
});

export default prisma;
