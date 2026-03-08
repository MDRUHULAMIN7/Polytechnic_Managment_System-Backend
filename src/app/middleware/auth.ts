
import { StatusCodes } from "http-status-codes";
import AppError from "../errors/AppError.js";
import type { TUserRole } from "../modules/user/user.interface.js";
import catchAsync from "../utils/CatchAsync.js";
import config from "../config/index.js";
import jwt,{type  JwtPayload } from "jsonwebtoken";
import { User } from "../modules/user/user.model.js";
import { createToken } from "../modules/Auth/auth.utils.js";

const accessCookieOptions = {
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  httpOnly: true,
  path: "/",
};

async function validateDecodedUser(decoded: JwtPayload) {
  const { userId, iat } = decoded;

  const user = await User.isUserExistsByCustomId(userId);

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, "This user is not found !");
  }

  if (user?.isDeleted) {
    throw new AppError(StatusCodes.FORBIDDEN, "This user is deleted !");
  }

  if (user?.status === "blocked") {
    throw new AppError(StatusCodes.FORBIDDEN, "This user is blocked ! !");
  }

  if (
    user.passwordChangedAt &&
    User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
  ) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "You are not authorized !");
  }

  return user;
}

function readBearerToken(value?: string) {
  if (!value) {
    return null;
  }

  return value.startsWith("Bearer ") ? value.slice(7) : value;
}

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req, res, next) => {
    const authHeader = readBearerToken(req.headers.authorization);
    const accessToken = authHeader || req.cookies?.pms_access_token || null;
    const refreshToken = req.cookies?.refreshToken || null;
    let decoded: JwtPayload | null = null;

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

    if (!decoded && refreshToken) {
      try {
        const refreshedDecoded = jwt.verify(
          refreshToken,
          config.jwt_refresh_secret as string,
        ) as JwtPayload;
        const refreshedUser = await validateDecodedUser(refreshedDecoded);
        const nextAccessToken = createToken(
          {
            userId: refreshedUser.id,
            role: refreshedUser.role,
          },
          config.jwt_access_secret as string,
          config.jwt_access_expires_in as jwt.SignOptions["expiresIn"],
        );

        res.cookie("pms_access_token", nextAccessToken, accessCookieOptions);
        res.cookie("pms_role", refreshedUser.role, {
          ...accessCookieOptions,
        });
        decoded = {
          ...refreshedDecoded,
          role: refreshedUser.role,
          userId: refreshedUser.id,
        };
      } catch {
        decoded = null;
      }
    }

    if (!decoded) {
      throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid or expired token!");
    }

    const user = await validateDecodedUser(decoded);
    const { role } = user;

    if (requiredRoles && !requiredRoles.includes(role)) {
      throw new AppError(
        StatusCodes.UNAUTHORIZED,
        'You are not authorized  user!',
      );
    }

    req.user = {
      ...decoded,
      role: user.role,
      userId: user.id,
    } as JwtPayload;
    next();
  });
};

export default auth;
