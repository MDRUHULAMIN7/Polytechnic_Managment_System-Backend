import { StatusCodes } from "http-status-codes";
import config from "../../config/index.js";
import catchAsync from "../../utils/CatchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { AuthServices } from "./auth.service.js";
import AppError from "../../errors/AppError.js";

const secureCookie = config.NODE_ENV === "production";
const sameSiteMode = (secureCookie ? "none" : "lax") as const;
const cookieBaseOptions = {
  secure: secureCookie,
  sameSite: sameSiteMode,
  path: "/",
};

function clearSessionCookies(res: Parameters<typeof sendResponse>[0]) {
  res.clearCookie("pms_access_token", cookieBaseOptions);
  res.clearCookie("pms_role", cookieBaseOptions);
  res.clearCookie("refreshToken", cookieBaseOptions);
}

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  const { refreshToken, accessToken, role, needsPasswordChange } = result;

  res.cookie("refreshToken", refreshToken, {
    ...cookieBaseOptions,
    httpOnly: true,
  });
  res.cookie("pms_access_token", accessToken, {
    ...cookieBaseOptions,
    httpOnly: true,
  });
  res.cookie("pms_role", role, {
    ...cookieBaseOptions,
    httpOnly: true,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User is logged in succesfully!',
    data: {
      role,
      needsPasswordChange,
    },
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { ...passwordData } = req.body;

  const result = await AuthServices.changePassword(req.user, passwordData);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password is updated succesfully!',
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;
  const result = await AuthServices.refreshToken(refreshToken);
  const { accessToken, role } = result;

  res.cookie("pms_access_token", accessToken, {
    ...cookieBaseOptions,
    httpOnly: true,
  });
  res.cookie("pms_role", role, {
    ...cookieBaseOptions,
    httpOnly: true,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Access token is retrieved succesfully !',
    data: { role },
  });
});

const logout = catchAsync(async (_req, res) => {
  clearSessionCookies(res);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User is logged out successfully!",
    data: null,
  });
});
const forgetPassword = catchAsync(async (req, res) => {
  const userId = req.body.id;
  const result = await AuthServices.forgetPassword(userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Reset link is generated succesfully!',
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Authorization token is required!');
  }

  const result = await AuthServices.resetPassword(req.body, token);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password reset succesful!',
    data: result,
  });
});

export const AuthControllers = {
  loginUser,
  changePassword,
  refreshToken,
  logout,
  forgetPassword,
  resetPassword,
};
