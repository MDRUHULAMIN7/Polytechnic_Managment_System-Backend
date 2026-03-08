import type cors from 'cors';

const defaultOrigins = [
  'http://localhost:3000',
  'https://polytechnic-managment-system-backen.vercel.app',
  'https://polytechnic-managment.vercel.app',
];

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

export function isOriginAllowed(origin?: string | null) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
