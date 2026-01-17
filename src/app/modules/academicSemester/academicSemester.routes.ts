import express from 'express';
import { AcademicSemesterControllers } from './academicSemester.controller.js';
import { academicSemesterValidationSchema } from './academicSemester.validation.js';
import validateRequest from '../../middleware/validateRequest.js';

const router = express.Router();

router.post(
  '/create-academic-semester',
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
