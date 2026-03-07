import type { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import catchAsync from '../utils/CatchAsync.js';
import { User } from '../modules/user/user.model.js';

const optionalAuth = () => {
  return catchAsync(async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      next();
      return;
    }

    let decoded: JwtPayload | null = null;

    try {
      decoded = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as JwtPayload;
    } catch {
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
