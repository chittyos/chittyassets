import type { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware with performance tracking
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Attach request ID to request for use in other middleware
  req.headers['x-request-id'] = requestId;

  // Log request start
  if (req.path.startsWith('/api')) {
    console.log(`[${requestId}] ${req.method} ${req.path} - Start`, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      query: req.query,
    });
  }

  // Capture response details
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (req.path.startsWith('/api')) {
      let logLine = `[${requestId}] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;

      // Add response summary for successful responses
      if (capturedJsonResponse && res.statusCode < 400) {
        if (capturedJsonResponse.success !== undefined) {
          logLine += ` :: ${JSON.stringify({ success: capturedJsonResponse.success })}`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      // Add error details for failed responses
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify({
          error: capturedJsonResponse.error?.code || 'UNKNOWN_ERROR'
        })}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + '…';
      }

      const logLevel = res.statusCode >= 500 ? 'error' :
                     res.statusCode >= 400 ? 'warn' : 'info';
      console[logLevel](logLine);
    }
  });

  next();
}

/**
 * Enhanced console log function that formats logs consistently
 */
export function log(message: string, source = 'express', level: 'info' | 'warn' | 'error' = 'info') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const logMessage = `${formattedTime} [${source}] ${message}`;
  console[level](logMessage);
}