import path from 'node:path';
import type { PrismaConfig } from 'prisma';

export default {
  earlyAccess: [],
  schema: path.join(__dirname, 'schema.prisma'),

  migrate: {
    async adapter() {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error('DATABASE_URL environment variable is not set');
      }
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
} satisfies PrismaConfig;
