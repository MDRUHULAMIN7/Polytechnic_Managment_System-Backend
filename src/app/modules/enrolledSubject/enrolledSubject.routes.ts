import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { EnrolledSubjectValidations } from './enrolledSubject.validation.js';
import { EnrolledSubjectControllers } from './enrolledSubject.controller.js';
import { USER_ROLE } from '../user/user.constant.js';

const router = express.Router();

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  EnrolledSubjectControllers.getAllEnrolledSubjects,
);

router.get(
  '/my-enrolled-subjects',
  auth(USER_ROLE.student),
  EnrolledSubjectControllers.getMyEnrolledSubjects,
);

router.get(
  '/offered-subject/:offeredSubjectId/mark-sheet',
  auth(USER_ROLE.admin, USER_ROLE.instructor, USER_ROLE.superAdmin),
  EnrolledSubjectControllers.getOfferedSubjectMarkSheet,
);

router.post(
  '/create-enrolled-subject',
  auth(USER_ROLE.student),
  validateRequest(
    EnrolledSubjectValidations.createEnrolledSubjectValidationZodSchema,
  ),
  EnrolledSubjectControllers.createEnrolledSubject,
);

router.patch(
  '/update-enrolled-subject-marks',
  auth(USER_ROLE.instructor),
  validateRequest(
    EnrolledSubjectValidations.updateEnrolledSubjectMarksValidationZodSchema,
  ),
  EnrolledSubjectControllers.upsertEnrolledSubjectMarks,
);

router.patch(
  '/release-component',
  auth(USER_ROLE.instructor),
  validateRequest(
    EnrolledSubjectValidations.releaseEnrolledSubjectComponentValidationZodSchema,
  ),
  EnrolledSubjectControllers.releaseOfferedSubjectComponent,
);

router.patch(
  '/publish-final-result',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(
    EnrolledSubjectValidations.publishFinalResultValidationZodSchema,
  ),
  EnrolledSubjectControllers.publishOfferedSubjectFinalResult,
);

export const EnrolledSubjectRoutes = router;
