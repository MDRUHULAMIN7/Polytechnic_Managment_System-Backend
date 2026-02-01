/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ErrorRequestHandler, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { TErrorSource } from '../../interface/error.js';
import config from '../config/index.js';
import handleZodError from '../errors/handleZodError.js';
import handleValidationError from '../errors/handleValidationError.js';

const globalErrorHandeler: ErrorRequestHandler = (
  err,
  req,
  res,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = err.message || 'Something went wrong';

  let errorSources: TErrorSource[] = [
    {
      path: '',
      message: 'Something went wrong',
    },
  ];

  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  }else if(err?.name === 'ValidationError'){
       const simplifiedError = handleValidationError(err);
    statusCode = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: config.NODE_ENV === 'development' ? err?.stack : null,
  });
};

export default globalErrorHandeler;
