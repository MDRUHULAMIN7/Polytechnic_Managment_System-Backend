import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import AppError from '../errors/AppError.js';
import config from '../config/index.js';
import { User } from '../modules/user/user.model.js';
import { createToken } from '../modules/Auth/auth.utils.js';

const isProduction = config.NODE_ENV === 'production';
const sameSiteMode: 'none' | 'lax' = isProduction ? 'none' : 'lax';

export const accessCookieOptions = {
  secure: isProduction,
  sameSite: sameSiteMode,
  httpOnly: true,
  path: '/',
};

export function readBearerToken(value?: string) {
  if (!value) {
    return null;
  }

  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

export async function validateDecodedUser(decoded: JwtPayload) {
  const { userId, iat } = decoded;

  const user = await User.isUserExistsByCustomId(userId);

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'This user is not found !');
  }

  if (user?.isDeleted) {
    throw new AppError(StatusCodes.FORBIDDEN, 'This user is deleted !');
  }

  if (user?.status === 'blocked') {
    throw new AppError(StatusCodes.FORBIDDEN, 'This user is blocked ! !');
  }

  if (
    user.passwordChangedAt &&
    User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
  ) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized !');
  }

  return user;
}

export async function resolveSessionUser({
  accessToken,
  refreshToken,
}: {
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  let decoded: JwtPayload | null = null;
  let nextAccessToken: string | null = null;

  if (accessToken) {
    try {
      decoded = jwt.verify(
        accessToken,
        config.jwt_access_secret as string,
      ) as JwtPayload;
    } catch {
      decoded = null;
    }
  }

  if (decoded) {
    const user = await validateDecodedUser(decoded);

    return {
      user,
      decoded: {
        ...decoded,
        role: user.role,
        userId: user.id,
      } as JwtPayload,
      nextAccessToken,
    };
  }

  if (!refreshToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token!');
  }

  const refreshedDecoded = jwt.verify(
    refreshToken,
    config.jwt_refresh_secret as string,
  ) as JwtPayload;
  const refreshedUser = await validateDecodedUser(refreshedDecoded);

  nextAccessToken = createToken(
    {
      userId: refreshedUser.id,
      role: refreshedUser.role,
    },
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as SignOptions['expiresIn'],
  );

  return {
    user: refreshedUser,
    decoded: {
      ...refreshedDecoded,
      role: refreshedUser.role,
      userId: refreshedUser.id,
    } as JwtPayload,
    nextAccessToken,
  };
}
