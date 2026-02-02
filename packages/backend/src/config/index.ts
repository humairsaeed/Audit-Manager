import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Password Policy
  PASSWORD_MIN_LENGTH: z.string().transform(Number).default('12'),
  PASSWORD_REQUIRE_UPPERCASE: z.string().transform((v) => v === 'true').default('true'),
  PASSWORD_REQUIRE_LOWERCASE: z.string().transform((v) => v === 'true').default('true'),
  PASSWORD_REQUIRE_NUMBERS: z.string().transform((v) => v === 'true').default('true'),
  PASSWORD_REQUIRE_SPECIAL: z.string().transform((v) => v === 'true').default('true'),
  MAX_LOGIN_ATTEMPTS: z.string().transform(Number).default('5'),
  LOCKOUT_DURATION_MINUTES: z.string().transform(Number).default('30'),

  // File Storage
  STORAGE_TYPE: z.enum(['s3', 'local']).default('s3'),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('audit-management'),
  S3_REGION: z.string().default('us-east-1'),
  S3_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('50'),
  ALLOWED_FILE_TYPES: z.string().default('pdf,docx,xlsx,xls,png,jpg,jpeg,gif,zip,txt,csv'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('Audit Management System'),
  SMTP_FROM_EMAIL: z.string().default('noreply@example.com'),

  // Teams
  TEAMS_WEBHOOK_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.string().default('combined'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('1000'),

  // Session
  SESSION_TIMEOUT_MINUTES: z.string().transform(Number).default('480'),

  // Import
  IMPORT_MAX_ROWS: z.string().transform(Number).default('10000'),
  IMPORT_CHUNK_SIZE: z.string().transform(Number).default('100'),

  // OpenAI / AI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default('4000'),
  OPENAI_TEMPERATURE: z.string().transform(Number).default('0.3'),
  AI_CACHE_TTL_HOURS: z.string().transform(Number).default('24'),
  AI_FALLBACK_ENABLED: z.string().transform((v) => v === 'true').default('true'),
  AI_RATE_LIMIT_PER_USER: z.string().transform(Number).default('50'),
  AI_RATE_LIMIT_WINDOW_HOURS: z.string().transform(Number).default('24'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const config = {
  app: {
    env: parseResult.data.NODE_ENV,
    port: parseResult.data.PORT,
    apiPrefix: parseResult.data.API_PREFIX,
    corsOrigins: parseResult.data.CORS_ORIGINS.split(','),
    isProduction: parseResult.data.NODE_ENV === 'production',
    isDevelopment: parseResult.data.NODE_ENV === 'development',
  },
  database: {
    url: parseResult.data.DATABASE_URL,
  },
  redis: {
    host: parseResult.data.REDIS_HOST,
    port: parseResult.data.REDIS_PORT,
    password: parseResult.data.REDIS_PASSWORD,
  },
  jwt: {
    secret: parseResult.data.JWT_SECRET,
    expiresIn: parseResult.data.JWT_EXPIRES_IN,
    refreshSecret: parseResult.data.JWT_REFRESH_SECRET,
    refreshExpiresIn: parseResult.data.JWT_REFRESH_EXPIRES_IN,
  },
  password: {
    minLength: parseResult.data.PASSWORD_MIN_LENGTH,
    requireUppercase: parseResult.data.PASSWORD_REQUIRE_UPPERCASE,
    requireLowercase: parseResult.data.PASSWORD_REQUIRE_LOWERCASE,
    requireNumbers: parseResult.data.PASSWORD_REQUIRE_NUMBERS,
    requireSpecial: parseResult.data.PASSWORD_REQUIRE_SPECIAL,
    maxLoginAttempts: parseResult.data.MAX_LOGIN_ATTEMPTS,
    lockoutDuration: parseResult.data.LOCKOUT_DURATION_MINUTES,
  },
  storage: {
    type: parseResult.data.STORAGE_TYPE,
    s3: {
      endpoint: parseResult.data.S3_ENDPOINT,
      publicUrl: parseResult.data.S3_PUBLIC_URL,
      accessKey: parseResult.data.S3_ACCESS_KEY,
      secretKey: parseResult.data.S3_SECRET_KEY,
      bucket: parseResult.data.S3_BUCKET,
      region: parseResult.data.S3_REGION,
      useSSL: parseResult.data.S3_USE_SSL,
    },
    maxFileSizeMB: parseResult.data.MAX_FILE_SIZE_MB,
    allowedFileTypes: parseResult.data.ALLOWED_FILE_TYPES.split(','),
  },
  email: {
    host: parseResult.data.SMTP_HOST,
    port: parseResult.data.SMTP_PORT,
    secure: parseResult.data.SMTP_SECURE,
    user: parseResult.data.SMTP_USER,
    password: parseResult.data.SMTP_PASSWORD,
    fromName: parseResult.data.SMTP_FROM_NAME,
    fromEmail: parseResult.data.SMTP_FROM_EMAIL,
  },
  teams: {
    webhookUrl: parseResult.data.TEAMS_WEBHOOK_URL,
  },
  logging: {
    level: parseResult.data.LOG_LEVEL,
    format: parseResult.data.LOG_FORMAT,
  },
  rateLimit: {
    windowMs: parseResult.data.RATE_LIMIT_WINDOW_MS,
    maxRequests: parseResult.data.RATE_LIMIT_MAX_REQUESTS,
  },
  session: {
    timeoutMinutes: parseResult.data.SESSION_TIMEOUT_MINUTES,
  },
  import: {
    maxRows: parseResult.data.IMPORT_MAX_ROWS,
    chunkSize: parseResult.data.IMPORT_CHUNK_SIZE,
  },
  ai: {
    openai: {
      apiKey: parseResult.data.OPENAI_API_KEY,
      model: parseResult.data.OPENAI_MODEL,
      maxTokens: parseResult.data.OPENAI_MAX_TOKENS,
      temperature: parseResult.data.OPENAI_TEMPERATURE,
    },
    cache: {
      ttlHours: parseResult.data.AI_CACHE_TTL_HOURS,
    },
    fallbackEnabled: parseResult.data.AI_FALLBACK_ENABLED,
    rateLimit: {
      perUser: parseResult.data.AI_RATE_LIMIT_PER_USER,
      windowHours: parseResult.data.AI_RATE_LIMIT_WINDOW_HOURS,
    },
  },
} as const;

export type Config = typeof config;
