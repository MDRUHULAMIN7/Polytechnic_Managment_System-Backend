import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const booleanLike = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

const optionalText = z.string().trim().optional().transform((value) => {
  if (!value) {
    return undefined;
  }

  return value;
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().trim().default('5000'),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  BCRYPT_SALT_ROUNDS: z.string().trim().default('10'),
  DEFAULT_PASS: z.string().trim().min(1, 'DEFAULT_PASS is required'),
  JWT_ACCESS_SECRET: z.string().trim().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().trim().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1, 'JWT_ACCESS_EXPIRES_IN is required'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .trim()
    .min(1, 'JWT_REFRESH_EXPIRES_IN is required'),
  RESET_PASS_UI_LINK: z.string().trim().min(1, 'RESET_PASS_UI_LINK is required'),
  PASSWORD_RESET_EMAIL_OVERRIDE: optionalText,
  CLOUDINARY_CLOUD_NAME: optionalText,
  CLOUDINARY_API_KEY: optionalText,
  CLOUDINARY_API_SECRET: optionalText,
  SMTP_HOST: optionalText,
  SMTP_PORT: z.string().trim().default('587'),
  SMTP_SECURE: z.union([z.literal('true'), z.literal('false')]).optional(),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  SMTP_FROM: optionalText,
  SUPER_ADMIN_PASSWORD: optionalText,
  SUPER_ADMIN_ID: z.string().trim().default('0001'),
  SUPER_ADMIN_EMAIL: z
    .string()
    .trim()
    .email('SUPER_ADMIN_EMAIL must be a valid email')
    .default('superadmin@example.com'),
  SUPER_ADMIN_SEED_ENABLED: booleanLike.default(true),
  OPENROUTER_API_KEY: optionalText,
  OPENROUTER_MODEL: optionalText,
  OPENROUTER_SITE_URL: optionalText,
  REQUEST_BODY_LIMIT: z.string().trim().default('1mb'),
  GENERAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  GENERAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  CHATBOT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  CHATBOT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  OPENROUTER_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  ENABLE_REQUEST_LOGGING: booleanLike.default(true),
  SEMESTER_ENROLLMENT_FEE_PER_CREDIT: z.coerce.number().min(0).default(0),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration. ${issues}`);
}

const env = parsedEnv.data;

const config = {
  NODE_ENV: env.NODE_ENV,
  port: env.PORT,
  database_url: env.DATABASE_URL,
  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
  default_password: env.DEFAULT_PASS,
  jwt_access_secret: env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
  reset_pass_ui_link: env.RESET_PASS_UI_LINK,
  password_reset_email_override: env.PASSWORD_RESET_EMAIL_OVERRIDE,
  cloudinary_cloud_name: env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: env.CLOUDINARY_API_SECRET,
  smtp_host: env.SMTP_HOST,
  smtp_port: env.SMTP_PORT,
  smtp_secure: env.SMTP_SECURE,
  smtp_user: env.SMTP_USER,
  smtp_pass: env.SMTP_PASS,
  smtp_from: env.SMTP_FROM,
  super_admin_password: env.SUPER_ADMIN_PASSWORD,
  super_admin_id: env.SUPER_ADMIN_ID,
  super_admin_email: env.SUPER_ADMIN_EMAIL,
  super_admin_seed_enabled: env.SUPER_ADMIN_SEED_ENABLED,
  openrouter_api_key: env.OPENROUTER_API_KEY,
  openrouter_model: env.OPENROUTER_MODEL,
  openrouter_site_url: env.OPENROUTER_SITE_URL,
  request_body_limit: env.REQUEST_BODY_LIMIT,
  general_rate_limit_window_ms: env.GENERAL_RATE_LIMIT_WINDOW_MS,
  general_rate_limit_max: env.GENERAL_RATE_LIMIT_MAX,
  auth_rate_limit_window_ms: env.AUTH_RATE_LIMIT_WINDOW_MS,
  auth_rate_limit_max: env.AUTH_RATE_LIMIT_MAX,
  chatbot_rate_limit_window_ms: env.CHATBOT_RATE_LIMIT_WINDOW_MS,
  chatbot_rate_limit_max: env.CHATBOT_RATE_LIMIT_MAX,
  openrouter_timeout_ms: env.OPENROUTER_TIMEOUT_MS,
  openrouter_max_retries: env.OPENROUTER_MAX_RETRIES,
  enable_request_logging: env.ENABLE_REQUEST_LOGGING,
  semester_enrollment_fee_per_credit: env.SEMESTER_ENROLLMENT_FEE_PER_CREDIT,
} as const;

export default config;
