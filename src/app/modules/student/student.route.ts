import express from 'express';
import { studentControllers } from './student.controller.js';
import { studentValidations } from './student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';
const router = express.Router();


//route will be call controller function

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  studentControllers.getAllStudents,
);
router.get(
  '/:studentId',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  studentControllers.getSingleStudent,
);
router.patch(
  '/:studentId',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  validateRequest(studentValidations.updateStudentValidationSchema),
  studentControllers.updateStudent,
);
router.delete(
  '/:studentId',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  studentControllers.deleteStudent,
);

export const StudentRoutes = router;
