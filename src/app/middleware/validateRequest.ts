import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import catchAsync from "../utils/CatchAsync.js";

const validateRequest = (schema: ZodTypeAny) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
    });

    next();
  });
};
export default validateRequest