import type { NextFunction, Request, Response } from 'express';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

export default function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!config.enable_request_logging) {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
      userId: req.user?.userId,
      role: req.user?.role,
      mutating: !['GET', 'HEAD', 'OPTIONS'].includes(req.method),
    });
  });

  next();
}
