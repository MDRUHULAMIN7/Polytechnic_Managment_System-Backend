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

router.get('/', AcademicSemesterControllers.getAllAcademicSemester);
router.get(
  '/:semesterID',
  AcademicSemesterControllers.getSingleAcademicSemester,
);
router.patch(
  '/:semesterID',
  validateRequest(
    academicSemesterValidationSchema.updateAcademicSemesterValidationSchema,
  ),
  AcademicSemesterControllers.updateAcademicSemester,
);

export const AcademicSemsterRoutes = router;
