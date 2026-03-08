import { StatusCodes } from "http-status-codes";
import type { JwtPayload } from "jsonwebtoken";
import AppError from "../errors/AppError.js";
import type { TUserRole } from "../modules/user/user.interface.js";
import catchAsync from "../utils/CatchAsync.js";
import {
  accessCookieOptions,
  readBearerToken,
  resolveSessionUser,
} from "../utils/session-auth.js";

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req, res, next) => {
    const authHeader = readBearerToken(req.headers.authorization);
    const accessToken = authHeader || req.cookies?.pms_access_token || null;
    const refreshToken = req.cookies?.refreshToken || null;
    const { user, decoded, nextAccessToken } = await resolveSessionUser({
      accessToken,
      refreshToken,
    });

    if (nextAccessToken) {
      res.cookie("pms_access_token", nextAccessToken, accessCookieOptions);
      res.cookie("pms_role", user.role, {
        ...accessCookieOptions,
      });
    }

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
