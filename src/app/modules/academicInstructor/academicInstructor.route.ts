import express from 'express';
import validateRequest from '../../middleware/validateRequest.js';
import { AcademicInstructorValidation } from './academicInstructor.validation.js';
import { AcademicInstructorControllers } from './academicInstructor.controller.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';


const router = express.Router();

router.post(
  '/create-academic-instructor',auth(USER_ROLE.superAdmin,USER_ROLE.admin),
  validateRequest(
    AcademicInstructorValidation.createAcademicInstructorValidationSchema,
  ),
  AcademicInstructorControllers.createAcademicInstructor,
);

router.get(
  '/:InstructorId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  AcademicInstructorControllers.getSingleAcademicInstructor,
);

router.patch(
  '/:InstructorId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(
    AcademicInstructorValidation.updateAcademicInstructorValidationSchema,
  ),
  AcademicInstructorControllers.updateAcademicInstructor,
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  AcademicInstructorControllers.getAllAcademicInstructors,
);

export const AcademicInstructorRoutes = router;
