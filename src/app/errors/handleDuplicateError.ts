import type { TErrorSource, TGenericErrorResponse } from "../../interface/error.js";

const handleDuplicateError = (err: any): TGenericErrorResponse => {
  const keyValue =
    (err && typeof err === 'object' && err.keyValue) || undefined;
  const keyPattern =
    (err && typeof err === 'object' && err.keyPattern) || undefined;

  let entries = Object.entries((keyValue ?? {}) as Record<string, unknown>);
  if (!entries.length && keyPattern && typeof keyPattern === 'object') {
    entries = Object.keys(keyPattern as Record<string, unknown>).map(
      (field) => [field, undefined],
    );
  }

  const errorSources: TErrorSource[] = entries.length
    ? entries.map(([field, value]) => ({
        path: field,
        message:
          value === undefined || value === null
            ? `${field} already exists `
            : `${field} ${value} already exists `,
      }))
    : [
        {
          path: '',
          message: 'Duplicate value already exists',
        },
      ];

  const statusCode = 409;

  return {
    statusCode,
    message: 'Duplicate key error',
    errorSources,
  };
};

export default handleDuplicateError;
