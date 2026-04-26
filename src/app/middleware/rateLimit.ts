import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { TUserRole } from '../modules/user/user.interface.js';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitRecord>();

function buildKey(req: Request, name: string) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : req.ip || 'unknown';
  const role = (req.user?.role as TUserRole | undefined) ?? 'guest';
  const userId = req.user?.userId ?? 'anonymous';

  return `${name}:${ip}:${role}:${userId}`;
}

export function createRateLimit(options: RateLimitOptions) {
  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = buildKey(req, options.name);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        errorSources: [
          {
            path: '',
            message: 'Too many requests. Please try again later.',
          },
        ],
      });
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}
