import mongoose from 'mongoose';
import type { TErrorSource, TGenericErrorResponse } from '../../interface/error.js';


const handleValidationError = (
  err: mongoose.Error.ValidationError,
): TGenericErrorResponse => {

  const errorSources: TErrorSource[]= Object.values(err.errors).map(
    (val: mongoose.Error.ValidatorError | mongoose.Error.CastError) => {
      return {
        path: val?.path,
        message: val?.message,
      };
    },
  );

  const statusCode = 400;

  return {
    statusCode,
    message: 'Validation Error',
    errorSources,
  };
};

export default handleValidationError;