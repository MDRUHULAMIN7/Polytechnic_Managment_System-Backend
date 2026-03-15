import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import catchAsync from '../utils/CatchAsync.js';
import { User } from '../modules/user/user.model.js';
import { createToken } from '../modules/Auth/auth.utils.js';

const isProduction = config.NODE_ENV === 'production';
const sameSiteMode: 'none' | 'lax' = isProduction ? 'none' : 'lax';

const accessCookieOptions = {
  secure: isProduction,
  sameSite: sameSiteMode,
  httpOnly: true,
  path: '/',
};

function readBearerToken(value?: string) {
  if (!value) {
    return null;
  }

  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

const optionalAuth = () => {
  return catchAsync(async (req, _res, next) => {
    const authHeader = readBearerToken(req.headers.authorization);
    const token = authHeader || req.cookies?.pms_access_token || null;
    const refreshToken = req.cookies?.refreshToken || null;

    let decoded: JwtPayload | null = null;

    if (token) {
      try {
        decoded = jwt.verify(
          token,
          config.jwt_access_secret as string,
        ) as JwtPayload;
      } catch {
        decoded = null;
      }
    }

    if (!decoded && refreshToken) {
      try {
        const refreshDecoded = jwt.verify(
          refreshToken,
          config.jwt_refresh_secret as string,
        ) as JwtPayload;
        const user = await User.isUserExistsByCustomId(refreshDecoded.userId);

        if (
          user &&
          !user.isDeleted &&
          user.status !== 'blocked' &&
          !(
            user.passwordChangedAt &&
            User.isJWTIssuedBeforePasswordChanged(
              user.passwordChangedAt,
              refreshDecoded.iat as number,
            )
          )
        ) {
          const nextAccessToken = createToken(
            {
              userId: user.id,
              role: user.role,
            },
            config.jwt_access_secret as string,
            config.jwt_access_expires_in as SignOptions['expiresIn'],
          );

          _res.cookie('pms_access_token', nextAccessToken, accessCookieOptions);
          _res.cookie('pms_role', user.role, accessCookieOptions);
          decoded = {
            ...refreshDecoded,
            userId: user.id,
            role: user.role,
          };
        }
      } catch {
        decoded = null;
      }
    }

    if (!decoded) {
      next();
      return;
    }

    const { userId, iat } = decoded;

    if (!userId) {
      next();
      return;
    }

    const user = await User.isUserExistsByCustomId(userId);

    if (!user || user.isDeleted || user.status === 'blocked') {
      next();
      return;
    }

    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number,
      )
    ) {
      next();
      return;
    }

    req.user = decoded;
    next();
  });
};

export default optionalAuth;
