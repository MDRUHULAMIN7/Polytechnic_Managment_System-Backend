import express from 'express';
import { OfferedSubjectControllers } from './OfferedSubject.controller.js';
import { OfferedSubjectValidations } from './OfferedSubject.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
const router = express.Router();

router.get('/', OfferedSubjectControllers.getAllOfferedSubjects);

router.get('/:id', OfferedSubjectControllers.getSingleOfferedSubjects);

router.post(
  '/create-offered-Subject',
  validateRequest(OfferedSubjectValidations.createOfferedSubjectValidationSchema),
  OfferedSubjectControllers.createOfferedSubject,
);

router.patch(
  '/:id',
  validateRequest(OfferedSubjectValidations.updateOfferedSubjectValidationSchema),
  OfferedSubjectControllers.updateOfferedSubject,
);

// router.delete(
//   '/:id',
//   OfferedSubjectControllers.deleteOfferedSubjectFromDB,
// );

export const offeredSubjectRoutes = router;