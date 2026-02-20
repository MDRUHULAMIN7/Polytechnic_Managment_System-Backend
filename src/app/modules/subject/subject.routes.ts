import express from 'express';
import { SubjectValidations } from './subject.validation.js';
import { SubjectControllers } from './subject.constroller.js';
import validateRequest from '../../middleware/validateRequest.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';

const router = express.Router();

// Create Subject
router.post(
  '/create-subject',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(SubjectValidations.createSubjectValidationSchema),
  SubjectControllers.createSubject
);

// Get Single Subject
router.get(
  '/:id',
  auth(
    USER_ROLE.admin,
    USER_ROLE.instructor,
    USER_ROLE.student,
    USER_ROLE.superAdmin,
  ),
  SubjectControllers.getSingleSubject,
);

// Update Subject
router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(SubjectValidations.updateSubjectValidationSchema),
  SubjectControllers.updateSubject
);

// Delete Subject
router.delete('/:id', auth(USER_ROLE.admin, USER_ROLE.superAdmin), SubjectControllers.deleteSubject);

// Assign Instructors to Subject
router.put(
  '/:subjectId/assign-instructors',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(SubjectValidations.instructorsWithSubjectValidationSchema),
  SubjectControllers.assignInstructorsWithSubject
);

// Remove Instructors from Subject
router.delete(
  '/:subjectId/remove-instructors',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(SubjectValidations.instructorsWithSubjectValidationSchema),
  SubjectControllers.removeInstructorsFromSubject
);

// Get All Subjects
router.get(
  '/',
  auth(
    USER_ROLE.admin,
    USER_ROLE.instructor,
    USER_ROLE.student,
    USER_ROLE.superAdmin,
  ),
  SubjectControllers.getAllSubjects,
);

export const SubjectRoutes = router;
