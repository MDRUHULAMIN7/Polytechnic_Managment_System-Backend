import express from 'express';
import { AcademicSemesterControllers } from './academicSemester.controller.js';
import { academicSemesterValidationSchema } from './academicSemester.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';

const router = express.Router();

router.post(
  '/create-academic-semester',
  auth(USER_ROLE.admin,USER_ROLE.superAdmin),
  validateRequest(
    academicSemesterValidationSchema.createAcademicSemesterValidationSchema,
  ),
  AcademicSemesterControllers.createAcademicSemester,
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin,USER_ROLE.student,USER_ROLE.instructor),
  AcademicSemesterControllers.getAllAcademicSemester,
);
router.get(
  '/:semesterID',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin,USER_ROLE.student,USER_ROLE.instructor),
  AcademicSemesterControllers.getSingleAcademicSemester,
);
router.patch(
  '/:semesterID',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(
    academicSemesterValidationSchema.updateAcademicSemesterValidationSchema,
  ),
  AcademicSemesterControllers.updateAcademicSemester,
);

export const AcademicSemsterRoutes = router;
