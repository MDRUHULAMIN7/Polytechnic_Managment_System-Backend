import bcrypt from 'bcrypt';
import type { TLoginUser } from './auth.interface.js';
import { User } from '../user/user.model.js';
import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import config from '../../config/index.js';
import { createToken, verifyToken } from './auth.utils.js';
import { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { sendEmail } from '../../utils/sendEmail.js';
import { logger } from '../../utils/logger.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials.';
const INVALID_SESSION_MESSAGE = 'Invalid session. Please log in again.';
const INVALID_PASSWORD_RESET_MESSAGE = 'Invalid or expired password reset request.';

function buildPasswordResetEmail(resetLink: string) {
  return {
    subject: 'Reset your password within ten minutes',
    text: [
      'We received a request to reset your password.',
      `Use this link within ten minutes: ${resetLink}`,
      'If you did not request this, you can safely ignore this message.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #f5f7fb; padding: 32px; color: #1f2937;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
          <div style="background: #1d4ed8; color: #ffffff; padding: 24px 28px;">
            <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
            <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.92;">This link will expire in ten minutes.</p>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.7;">
              We received a request to reset your password. Click the button below to continue.
            </p>
            <p style="margin: 0 0 22px;">
              <a
                href="${resetLink}"
                style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;"
              >
                Reset Password
              </a>
            </p>
            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #4b5563;">
              If you did not request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

const loginUser = async (payload: TLoginUser) => {
  // checking if the user is exist
  const user = await User.isUserExistsByCustomId(payload.id);

  if (!user || user.isDeleted || user.status === 'blocked') {
    throw new AppError(StatusCodes.UNAUTHORIZED, INVALID_CREDENTIALS_MESSAGE);
  }

  //checking if the password is correct

  if (!(await User.isPasswordMatched(payload?.password, user?.password)))
    throw new AppError(StatusCodes.UNAUTHORIZED, INVALID_CREDENTIALS_MESSAGE);

  //create token and sent to the  client

  const jwtPayload = {
    userId: user.id,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as SignOptions['expiresIn'],
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as SignOptions['expiresIn'],
  );

  return {
    refreshToken,
    accessToken,
    role: user.role,
    needsPasswordChange: user?.needsPasswordChange,
  };
};

const changePassword = async (
  userData: JwtPayload,
  payload: { oldPassword: string; newPassword: string },
) => {
  // checking if the user is exist
  const user = await User.isUserExistsByCustomId(userData.userId);

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'This user is not found !');
  }
  // checking if the user is already deleted

  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(StatusCodes.FORBIDDEN, 'This user is deleted !');
  }

  // checking if the user is blocked

  const userStatus = user?.status;

  if (userStatus === 'blocked') {
    throw new AppError(StatusCodes.FORBIDDEN, 'This user is blocked ! !');
  }

  //checking if the password is correct

  if (!(await User.isPasswordMatched(payload.oldPassword, user?.password)))
    throw new AppError(StatusCodes.FORBIDDEN, 'Password do not matched');

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    {
      id: userData.userId,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      needsPasswordChange: false,
      passwordChangedAt: new Date(),
    },
  );

  return null;
};

const refreshToken = async (token: string) => {
  // checking if the given token is valid
  const decoded = verifyToken(token, config.jwt_refresh_secret as string);

  const { userId, iat } = decoded;

  // checking if the user is exist
  const user = await User.isUserExistsByCustomId(userId);

  if (!user || user.isDeleted || user.status === 'blocked') {
    throw new AppError(StatusCodes.UNAUTHORIZED, INVALID_SESSION_MESSAGE);
  }

  if (
    user.passwordChangedAt &&
    User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
  ) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized !');
  }

  const jwtPayload = {
    userId: user.id,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as SignOptions['expiresIn'],
  );

  return {
    accessToken,
    role: user.role,
  };
};

const forgetPassword = async (userId: string) => {
  // checking if the user is exist
  const user = await User.isUserExistsByCustomId(userId);

  if (!user || user.isDeleted || user.status === 'blocked') {
    return null;
  }

  const jwtPayload = {
    userId: user.id,
    role: user.role,
  };

  const resetToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '10m',
  );

  const resetUILink = `${config.reset_pass_ui_link}?id=${user.id}&token=${resetToken}`;
  const deliveryEmail = user.email;
  const message = buildPasswordResetEmail(resetUILink);

  try {
    await sendEmail({
      to: deliveryEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return null;
  } catch (error) {
    logger.error('Password reset email delivery failed.', {
      userId: user.id,
      deliveryEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const resetPassword = async (
  payload: { id: string; newPassword: string },
  token: string,
) => {
  // checking if the user is exist
  const user = await User.isUserExistsByCustomId(payload?.id);

  if (!user || user.isDeleted || user.status === 'blocked') {
    throw new AppError(StatusCodes.UNAUTHORIZED, INVALID_PASSWORD_RESET_MESSAGE);
  }

  const decoded = verifyToken(token, config.jwt_access_secret as string);

  if (payload.id !== decoded.userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, INVALID_PASSWORD_RESET_MESSAGE);
  }

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    {
      id: decoded.userId,
      role: decoded.role,
    },
    {
      password: newHashedPassword,
      needsPasswordChange: false,
      passwordChangedAt: new Date(),
    },
  );
};
export const AuthServices = {
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
};
