import express from 'express';
import { AuthValidation } from './auth.validation.js';
import { AuthControllers } from './auth.controller.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import auth from '../../middleware/auth.js';
import { createRateLimit } from '../../middleware/rateLimit.js';
import config from '../../config/index.js';
const router = express.Router();

const authRateLimit = createRateLimit({
  name: 'auth-route',
  windowMs: config.auth_rate_limit_window_ms,
  max: config.auth_rate_limit_max,
});

router.post(
  '/login',
  authRateLimit,
  validateRequest(AuthValidation.loginValidationSchema),
  AuthControllers.loginUser,
);

router.post(
  '/change-password',
  auth(
    USER_ROLE.admin,
    USER_ROLE.instructor,
    USER_ROLE.student,
    USER_ROLE.superAdmin,
  ),
  validateRequest(AuthValidation.changePasswordValidationSchema),
  AuthControllers.changePassword,
);

router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthControllers.refreshToken,
);

router.post('/logout', AuthControllers.logout);
router.post(
  '/forget-password',
  authRateLimit,
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
);

export const AuthRoutes = router;

