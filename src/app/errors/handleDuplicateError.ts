import type { TErrorSource, TGenericErrorResponse } from "../../interface/error.js";

const fieldLabelMap: Record<string, string> = {
  code: 'Code',
  credits: 'Credits',
  email: 'Email',
  id: 'ID',
  title: 'Title',
};

function formatFieldLabel(field: string) {
  return (
    fieldLabelMap[field] ??
    field
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

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
    ? entries.map(([field]) => ({
        path: field,
        message: `${formatFieldLabel(field)} already exists. Please use a different value.`,
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
