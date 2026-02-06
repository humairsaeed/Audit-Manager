import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

const modelsWithSoftDelete = ['User', 'Audit', 'Observation', 'Evidence', 'Comment', 'AuditDocument'];

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const basePrisma = new PrismaClient({
    log: config.app.isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  });

  // Prisma 7 uses $extends instead of $use for middleware
  return basePrisma.$extends({
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (modelsWithSoftDelete.includes(model)) {
            // Soft delete - convert delete to update
            return (basePrisma as any)[model].update({
              ...args,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (modelsWithSoftDelete.includes(model)) {
            // Soft delete - convert deleteMany to updateMany
            return (basePrisma as any)[model].updateMany({
              ...args,
              data: { ...((args as any).data || {}), deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (modelsWithSoftDelete.includes(model)) {
            // Filter out soft deleted records
            return (basePrisma as any)[model].findFirst({
              ...args,
              where: {
                ...(args.where || {}),
                deletedAt: null,
              },
            });
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (modelsWithSoftDelete.includes(model)) {
            return query({
              ...args,
              where: {
                ...(args.where || {}),
                deletedAt: null,
              },
            });
          }
          return query(args);
        },
        async findMany({ model, args, query }) {
          if (modelsWithSoftDelete.includes(model)) {
            const where = args.where || {};
            if ((where as any).deletedAt === undefined) {
              return query({
                ...args,
                where: {
                  ...where,
                  deletedAt: null,
                },
              });
            }
          }
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!config.app.isProduction) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
