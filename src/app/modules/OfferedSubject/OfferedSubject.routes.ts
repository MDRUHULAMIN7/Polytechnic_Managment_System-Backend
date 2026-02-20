import express from 'express';
import { OfferedSubjectControllers } from './OfferedSubject.controller.js';
import { OfferedSubjectValidations } from './OfferedSubject.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';
const router = express.Router();

router.get(
  '/',
  auth(
    USER_ROLE.admin,
    USER_ROLE.instructor,
    USER_ROLE.student,
    USER_ROLE.superAdmin,
  ),
  OfferedSubjectControllers.getAllOfferedSubjects,
);

router.get(
  '/:id',
  auth(
    USER_ROLE.admin,
    USER_ROLE.instructor,
    USER_ROLE.student,
    USER_ROLE.superAdmin,
  ),
  OfferedSubjectControllers.getSingleOfferedSubjects,
);

router.post(
  '/create-offered-Subject',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(OfferedSubjectValidations.createOfferedSubjectValidationSchema),
  OfferedSubjectControllers.createOfferedSubject,
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(OfferedSubjectValidations.updateOfferedSubjectValidationSchema),
  OfferedSubjectControllers.updateOfferedSubject,
);

// router.delete(
//   '/:id',
//   OfferedSubjectControllers.deleteOfferedSubjectFromDB,
// );

export const offeredSubjectRoutes = router;
