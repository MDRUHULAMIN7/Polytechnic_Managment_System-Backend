import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { PeriodConfigControllers } from './periodConfig.controller.js';
import { PeriodConfigValidations } from './periodConfig.validation.js';

const router = express.Router();

router.get(
  '/active',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.student, USER_ROLE.instructor),
  PeriodConfigControllers.getActivePeriodConfig,
);

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.student, USER_ROLE.instructor),
  PeriodConfigControllers.getAllPeriodConfigs,
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin, USER_ROLE.student, USER_ROLE.instructor),
  PeriodConfigControllers.getSinglePeriodConfig,
);

router.post(
  '/',
  auth(USER_ROLE.superAdmin),
  validateRequest(PeriodConfigValidations.createPeriodConfigValidationSchema),
  PeriodConfigControllers.createPeriodConfig,
);

router.patch(
  '/:id',
  auth(USER_ROLE.superAdmin),
  validateRequest(PeriodConfigValidations.updatePeriodConfigValidationSchema),
  PeriodConfigControllers.updatePeriodConfig,
);

export const PeriodConfigRoutes = router;
