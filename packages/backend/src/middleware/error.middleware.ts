import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import logger from '../lib/logger.js';
import { ApiResponse } from '../types/index.js';
import { config } from '../config/index.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(403, code, message);
  }

  static notFound(resource = 'Resource', code = 'NOT_FOUND') {
    return new AppError(404, code, `${resource} not found`);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, code, message);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(422, 'VALIDATION_ERROR', message, details);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: [
        {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      ],
    } as ApiResponse);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      code: 'VALIDATION_ERROR',
      message: e.message,
      field: e.path.join('.'),
    }));

    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    } as ApiResponse);
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let code = 'DATABASE_ERROR';
    let message = 'Database operation failed';

    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        const target = (err.meta?.target as string[])?.join(', ');
        message = `A record with this ${target || 'value'} already exists`;
        break;
      case 'P2003':
        // Foreign key constraint violation
        statusCode = 400;
        code = 'INVALID_REFERENCE';
        message = 'Referenced record does not exist';
        break;
      case 'P2025':
        // Record not found
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      default:
        logger.error('Unhandled Prisma error:', err);
    }

    res.status(statusCode).json({
      success: false,
      message,
      errors: [{ code, message }],
    } as ApiResponse);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      errors: [{ code: 'VALIDATION_ERROR', message: 'Invalid data format' }],
    } as ApiResponse);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      errors: [{ code: 'INVALID_TOKEN', message: 'Authentication token is invalid' }],
    } as ApiResponse);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expired',
      errors: [{ code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' }],
    } as ApiResponse);
    return;
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    const code = 'FILE_UPLOAD_ERROR';

    switch ((err as NodeJS.ErrnoException).code) {
      case 'LIMIT_FILE_SIZE':
        message = `File size exceeds limit of ${config.storage.maxFileSizeMB}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
    }

    res.status(400).json({
      success: false,
      message,
      errors: [{ code, message }],
    } as ApiResponse);
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: config.app.isProduction ? 'Internal server error' : err.message,
    errors: [
      {
        code: 'INTERNAL_ERROR',
        message: config.app.isProduction ? 'An unexpected error occurred' : err.message,
      },
    ],
  } as ApiResponse);
};

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    errors: [
      {
        code: 'ROUTE_NOT_FOUND',
        message: `Cannot ${req.method} ${req.path}`,
      },
    ],
  } as ApiResponse);
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
