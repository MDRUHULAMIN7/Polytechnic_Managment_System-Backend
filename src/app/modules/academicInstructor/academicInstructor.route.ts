import express from 'express';
import validateRequest from '../../middleware/validateRequest.js';
import { AcademicInstructorValidation } from './academicInstructor.validation.js';
import { AcademicInstructorControllers } from './academicInstructor.controller.js';


const router = express.Router();

router.post(
  '/create-academic-instructor',
  validateRequest(
    AcademicInstructorValidation.createAcademicInstructorValidationSchema,
  ),
  AcademicInstructorControllers.createAcademicInstructor,
);

router.get('/:InstructorId', AcademicInstructorControllers.getSingleAcademicInstructor);

router.patch(
  '/:InstructorId',
  validateRequest(
    AcademicInstructorValidation.updateAcademicInstructorValidationSchema,
  ),
  AcademicInstructorControllers.updateAcademicInstructor,
);

router.get('/', AcademicInstructorControllers.getAllAcademicInstructors);

export const AcademicInstructorRoutes = router;