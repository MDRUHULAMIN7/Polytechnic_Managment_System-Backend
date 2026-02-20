import express from 'express';
import { AuthValidation } from './auth.validation.js';
import { AuthControllers } from './auth.controller.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import auth from '../../middleware/auth.js';
const router = express.Router();

router.post(
  '/login',
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
router.post(
  '/forget-password',
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.resetPassword,
);

export const AuthRoutes = router;

// http://localhost:3000/?id=A-0001&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJBLTAwMDEiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzEyMzM3MzgsImV4cCI6MTc3MTIzNDMzOH0.IZC_QBMKoHVg0ewIT5S6KEzQMR9b9xwwfgskR9nn0Ds
