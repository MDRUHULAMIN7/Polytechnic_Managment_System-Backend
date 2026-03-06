import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { CurriculumControllers } from './curriculum.controller.js';
import { CurriculumValidations } from './curriculum.validation.js';

const router = express.Router();

router.post(
  '/create-curriculum',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(CurriculumValidations.createCurriculumValidationSchema),
  CurriculumControllers.createCurriculum,
);

router.get(
  '/:id',
  CurriculumControllers.getSingleCurriculum,
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(CurriculumValidations.updateCurriculumValidationSchema),
  CurriculumControllers.updateCurriculum,
);

router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  CurriculumControllers.deleteCurriculum,
);

router.get(
  '/',
  CurriculumControllers.getAllCurriculums,
);

export const CurriculumRoutes = router;
