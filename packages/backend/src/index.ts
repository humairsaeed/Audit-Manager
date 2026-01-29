import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import logger from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { auditLogMiddleware } from './middleware/audit-log.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import roleRoutes from './routes/role.routes.js';
import auditRoutes from './routes/audit.routes.js';
import observationRoutes from './routes/observation.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';
import importRoutes from './routes/import.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import entityRoutes from './routes/entity.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import reportRoutes from './routes/report.routes.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.app.corsOrigins,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (config.app.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// Audit logging for modifying requests
app.use(auditLogMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
const apiPrefix = config.app.apiPrefix;
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/roles`, roleRoutes);
app.use(`${apiPrefix}/audits`, auditRoutes);
app.use(`${apiPrefix}/observations`, observationRoutes);
app.use(`${apiPrefix}/evidence`, evidenceRoutes);
app.use(`${apiPrefix}/import`, importRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/entities`, entityRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/settings`, settingsRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.app.port, () => {
  logger.info(`🚀 Server running on port ${config.app.port}`);
  logger.info(`📚 API available at http://localhost:${config.app.port}${config.app.apiPrefix}`);
  logger.info(`🔧 Environment: ${config.app.env}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connection
    await prisma.$disconnect();
    logger.info('Database connection closed');

    process.exit(0);
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
