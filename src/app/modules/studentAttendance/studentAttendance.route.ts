import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { StudentAttendanceControllers } from './studentAttendance.controller.js';
import { StudentAttendanceValidations } from './studentAttendance.validation.js';

const router = express.Router();

router.post(
  '/submit',
  auth(USER_ROLE.instructor),
  validateRequest(StudentAttendanceValidations.submitStudentAttendanceValidationSchema),
  StudentAttendanceControllers.submitStudentAttendance,
);

router.patch(
  '/:id',
  auth(USER_ROLE.instructor),
  validateRequest(StudentAttendanceValidations.updateStudentAttendanceValidationSchema),
  StudentAttendanceControllers.updateStudentAttendance,
);

router.get(
  '/my-attendance',
  auth(USER_ROLE.student),
  StudentAttendanceControllers.getMyAttendanceSummary,
);

router.get(
  '/class/:classSessionId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.instructor),
  StudentAttendanceControllers.getClassAttendance,
);

export const StudentAttendanceRoutes = router;
