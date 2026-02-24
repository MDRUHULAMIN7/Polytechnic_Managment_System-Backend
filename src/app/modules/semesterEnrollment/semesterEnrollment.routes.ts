import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { SemesterEnrollmentControllers } from './semesterEnrollment.controller.js';
import { SemesterEnrollmentValidations } from './semesterEnrollment.validation.js';

const router = express.Router();

router.post(
  '/create-semester-enrollment',
  auth(USER_ROLE.student),
  validateRequest(
    SemesterEnrollmentValidations.createSemesterEnrollmentValidationSchema,
  ),
  SemesterEnrollmentControllers.createSemesterEnrollment,
);

router.get(
  '/my-semester-enrollments',
  auth(USER_ROLE.student),
  SemesterEnrollmentControllers.getMySemesterEnrollments,
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.instructor),
  SemesterEnrollmentControllers.getAllSemesterEnrollments,
);

export const SemesterEnrollmentRoutes = router;
