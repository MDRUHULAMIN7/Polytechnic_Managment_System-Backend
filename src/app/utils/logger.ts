type LogLevel = 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown> | undefined;

function serializeMeta(meta: LogMeta) {
  if (!meta) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  );
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(serializeMeta(meta) ? { meta: serializeMeta(meta) } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }

  if (level === 'warn') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    writeLog('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    writeLog('warn', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    writeLog('error', message, meta);
  },
};
