import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { ClassSessionControllers } from './classSession.controller.js';
import { ClassSessionValidations } from './classSession.validation.js';

const router = express.Router();

router.get(
  '/dashboard-summary',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  ClassSessionControllers.getRoleDashboardSummary,
);

router.post(
  '/sync',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(ClassSessionValidations.syncClassSessionsValidationSchema),
  ClassSessionControllers.syncClassSessions,
);

router.get(
  '/my',
  auth(USER_ROLE.instructor),
  ClassSessionControllers.getInstructorClassSessions,
);

router.get(
  '/my-classes',
  auth(USER_ROLE.student),
  ClassSessionControllers.getStudentClassSessions,
);

router.get(
  '/:id/instructor-details',
  auth(USER_ROLE.instructor),
  ClassSessionControllers.getInstructorClassSessionDetails,
);

router.patch(
  '/:id/start',
  auth(USER_ROLE.instructor),
  validateRequest(ClassSessionValidations.startClassSessionValidationSchema),
  ClassSessionControllers.startClassSession,
);

router.get(
  '/:id/student-details',
  auth(USER_ROLE.student),
  ClassSessionControllers.getStudentClassSessionDetails,
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  ClassSessionControllers.getSingleClassSession,
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  ClassSessionControllers.getAllClassSessions,
);

export const ClassSessionRoutes = router;
