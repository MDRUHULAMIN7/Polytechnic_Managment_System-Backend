/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ErrorRequestHandler, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { TErrorSource } from '../../interface/error.js';
import config from '../config/index.js';
import handleZodError from '../errors/handleZodError.js';
import handleValidationError from '../errors/handleValidationError.js';
import handleCastError from '../errors/handleCastError.js';
import handleDuplicateError from '../errors/handleDuplicateError.js';
import AppError from '../errors/AppError.js';

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
  } else if (err?.name === 'CastError') {
    const simplifiedError = handleCastError(err);
    statusCode = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  } else if (err?.code === 11000) {
    const simplifiedError = handleDuplicateError(err);
    statusCode = simplifiedError?.statusCode;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  } else if (err instanceof AppError) {
    statusCode = err?.statusCode;
    message = err.message;
    errorSources = [
      {
        path: '',
        message: err?.message,
      },
    ];
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        path: '',
        message: err?.message,
      },
    ];
  } 

  return res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: config.NODE_ENV === 'development' ? err?.stack : null,
    err
  });
};

export default globalErrorHandeler;
