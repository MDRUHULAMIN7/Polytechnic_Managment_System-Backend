import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { EnrolledSubjectValidations } from './enrolledSubject.validation.js';
import { EnrolledSubjectControllers } from './enrolledSubject.controller.js';


const router = express.Router();

router.post(
  '/create-enrolled-subject',
  auth('student'),
  validateRequest(
    EnrolledSubjectValidations.createEnrolledSubjectValidationZodSchema,
  ),
  EnrolledSubjectControllers.createEnrolledSubject,
);

router.patch(
  '/update-enrolled-subject-marks',
  auth('instructor'),
  validateRequest(
    EnrolledSubjectValidations.updateEnrolledSubjectMarksValidationZodSchema,
  ),
  EnrolledSubjectControllers.updateEnrolledSubjectMarks,
);

export const EnrolledSubjectRoutes = router;
