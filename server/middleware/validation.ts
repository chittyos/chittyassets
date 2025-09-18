import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Generic request validation middleware using Zod schemas
 */
export function validateRequest<
  TBody = any,
  TQuery = any,
  TParams = any
>(schemas: {
  body?: z.ZodSchema<TBody>;
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schemas.body) {
        const bodyResult = schemas.body.safeParse(req.body);
        if (!bodyResult.success) {
          throw new ValidationError('Invalid request body', {
            field: 'body',
            issues: bodyResult.error.issues,
          });
        }
        req.body = bodyResult.data;
      }

      // Validate query parameters
      if (schemas.query) {
        const queryResult = schemas.query.safeParse(req.query);
        if (!queryResult.success) {
          throw new ValidationError('Invalid query parameters', {
            field: 'query',
            issues: queryResult.error.issues,
          });
        }
        req.query = queryResult.data;
      }

      // Validate route parameters
      if (schemas.params) {
        const paramsResult = schemas.params.safeParse(req.params);
        if (!paramsResult.success) {
          throw new ValidationError('Invalid route parameters', {
            field: 'params',
            issues: paramsResult.error.issues,
          });
        }
        req.params = paramsResult.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Asset ID parameter
  assetId: z.object({
    assetId: z.string().uuid('Asset ID must be a valid UUID'),
  }),

  // Evidence ID parameter
  evidenceId: z.object({
    evidenceId: z.string().uuid('Evidence ID must be a valid UUID'),
  }),

  // User ID parameter
  userId: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),

  // Search query
  search: z.object({
    q: z.string().min(1, 'Search query is required').optional(),
    type: z.string().optional(),
    status: z.string().optional(),
  }),

  // File upload metadata
  fileMetadata: z.object({
    originalName: z.string().min(1, 'Original filename is required'),
    mimeType: z.string().min(1, 'MIME type is required'),
    size: z.number().min(1, 'File size must be greater than 0'),
  }),

  // Date range filter
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }).refine(
    (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      message: 'Start date must be before or equal to end date',
      path: ['dateRange'],
    }
  ),
};

/**
 * Middleware to validate file uploads
 */
export function validateFileUpload(options: {
  maxSize?: number;
  allowedMimeTypes?: string[];
  required?: boolean;
} = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes,
    required = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const file = files?.[0];

      if (required && !file) {
        throw new ValidationError('File upload is required');
      }

      if (file) {
        // Check file size
        if (file.size > maxSize) {
          throw new ValidationError(
            `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`,
            { actualSize: file.size, maxSize }
          );
        }

        // Check MIME type
        if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
          throw new ValidationError(
            `File type ${file.mimetype} is not allowed`,
            { allowedTypes: allowedMimeTypes, actualType: file.mimetype }
          );
        }

        // Validate file metadata
        const metadataResult = commonSchemas.fileMetadata.safeParse({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        });

        if (!metadataResult.success) {
          throw new ValidationError('Invalid file metadata', metadataResult.error.issues);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Basic sanitization function (in production, use a proper library like DOMPurify)
  function sanitize(obj: any): any {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  }

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
}