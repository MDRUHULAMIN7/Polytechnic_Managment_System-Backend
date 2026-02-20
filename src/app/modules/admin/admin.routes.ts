import express from 'express';
import { AdminControllers } from './admin.controller.js';
import validateRequest from '../../middleware/validateRequest.js';
import { updateAdminValidationSchema } from './admin.validation.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';


const router = express.Router();

router.get('/', auth(USER_ROLE.superAdmin), AdminControllers.getAllAdmins);

router.get('/:id', auth(USER_ROLE.superAdmin), AdminControllers.getSingleAdmin);

router.patch(
  '/:id',
  auth(USER_ROLE.superAdmin),
  validateRequest(updateAdminValidationSchema),
  AdminControllers.updateAdmin,
);

router.delete('/:adminId', auth(USER_ROLE.superAdmin), AdminControllers.deleteAdmin);

export const AdminRoutes = router;
