import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(meta).length > 0) {
    msg += ` ${JSON.stringify(meta)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true })
  ),
  defaultMeta: { service: 'audit-management' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.app.isDevelopment
        ? combine(colorize(), devFormat)
        : json(),
    }),
    // File transports for production
    ...(config.app.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: json(),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: json(),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});

// Create audit logger for security events
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'audit-management', type: 'audit' },
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      format: json(),
      maxsize: 10485760, // 10MB
      maxFiles: 30,
    }),
  ],
});

export default logger;
