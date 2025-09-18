import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Standard API Error class for consistent error handling
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error types for convenience
 */
export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends APIError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Standard API response interface
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Helper function to create success responses
 */
export function createSuccessResponse<T>(data: T, meta?: any): APIResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Helper function to create error responses
 */
export function createErrorResponse(
  error: APIError | Error,
  requestId?: string
): APIResponse {
  const apiError = error instanceof APIError ? error : new APIError(error.message);

  return {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Centralized error handling middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Convert to APIError if it's not already
  const apiError = err instanceof APIError ? err : new APIError(
    process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    500,
    'INTERNAL_ERROR'
  );

  // Log error details (in production, use proper logging service)
  const logLevel = apiError.statusCode >= 500 ? 'error' : 'warn';
  console[logLevel](`[${requestId}] ${apiError.code}: ${apiError.message}`, {
    statusCode: apiError.statusCode,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: apiError.details,
  });

  // Send standardized error response
  res.status(apiError.statusCode).json(createErrorResponse(apiError, requestId));
};

/**
 * Async error wrapper - catches async errors and passes them to error handler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response) {
  const error = new NotFoundError('Endpoint');
  res.status(404).json(createErrorResponse(error));
}

/**
 * Request validation middleware generator
 */
export function validateRequest(schema: any, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}