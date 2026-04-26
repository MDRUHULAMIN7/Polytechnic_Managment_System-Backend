import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import catchAsync from "../utils/CatchAsync.js";

type ParsedRequestParts = {
  body?: Request['body'];
  params?: Request['params'];
  query?: Request['query'];
  cookies?: Request['cookies'];
  headers?: Request['headers'];
};

const syncReadonlyRequestObject = (
  currentValue: Request['query'],
  nextValue?: Request['query'],
) => {
  if (!nextValue || currentValue === nextValue) {
    return;
  }

  const currentQuery = currentValue as Record<string, unknown>;
  const parsedQuery = nextValue as Record<string, unknown>;

  for (const key of Object.keys(currentQuery)) {
    delete currentQuery[key];
  }

  Object.assign(currentQuery, parsedQuery);
};

const validateRequest = (schema: ZodTypeAny) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = (await schema.parseAsync({
      body: req.body,
      params: req.params,
      query: req.query,
      cookies: req.cookies,
      headers: req.headers,
    })) as ParsedRequestParts;

    req.body = parsed.body ?? req.body;
    req.params = parsed.params ?? req.params;
    syncReadonlyRequestObject(req.query, parsed.query);

    next();
  });
};
export default validateRequest
