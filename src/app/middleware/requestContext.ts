import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export default function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = req.headers['x-request-id'];
  const resolvedRequestId =
    typeof requestId === 'string' && requestId.trim()
      ? requestId.trim()
      : randomUUID();

  req.requestId = resolvedRequestId;
  res.setHeader('x-request-id', resolvedRequestId);
  next();
}
