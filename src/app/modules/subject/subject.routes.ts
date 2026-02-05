import express from 'express';
import { SubjectValidations } from './subject.validation.js';
import { SubjectControllers } from './subject.constroller.js';
import validateRequest from '../../middleware/validateRequest.js';

const router = express.Router();

// Create Subject
router.post(
  '/create-subject',
  validateRequest(SubjectValidations.createSubjectValidationSchema),
  SubjectControllers.createSubject
);

// Get Single Subject
router.get('/:id', SubjectControllers.getSingleSubject);

// Update Subject
router.patch(
  '/:id',
  validateRequest(SubjectValidations.updateSubjectValidationSchema),
  SubjectControllers.updateSubject
);

// Delete Subject
router.delete('/:id', SubjectControllers.deleteSubject);

// Assign Instructors to Subject
router.put(
  '/:subjectId/assign-instructors',
  validateRequest(SubjectValidations.instructorsWithSubjectValidationSchema),
  SubjectControllers.assignInstructorsWithSubject
);

// Remove Instructors from Subject
router.delete(
  '/:subjectId/remove-instructors',
  validateRequest(SubjectValidations.instructorsWithSubjectValidationSchema),
  SubjectControllers.removeInstructorsFromSubject
);

// Get All Subjects
router.get('/', SubjectControllers.getAllSubjects);

export const SubjectRoutes = router;
