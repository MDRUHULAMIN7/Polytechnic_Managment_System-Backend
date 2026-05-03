import { randomUUID } from 'crypto';

/**
 * Generates a secure random ID using Node.js crypto module
 * @returns UUID v4 string
 */
export function generateSecureId(): string {
  return randomUUID();
}

/**
 * Generates a secure random suffix for file uploads
 * @returns Random string suitable for file naming
 */
export function generateSecureFileSuffix(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Generates a secure numeric suffix (for compatibility with existing patterns)
 * @returns Random numeric string
 */
export function generateSecureNumericSuffix(): string {
  const buffer = Buffer.alloc(4);
  crypto.getRandomValues(new Uint32Array(buffer.buffer));
  return Math.abs(buffer.readInt32BE(0)).toString();
}
