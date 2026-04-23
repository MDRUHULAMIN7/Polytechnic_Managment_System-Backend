import express from 'express';
import auth from '../../middleware/auth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { RoomControllers } from './room.controller.js';
import { RoomValidations } from './room.validation.js';

const router = express.Router();

router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  RoomControllers.getAllRooms,
);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  RoomControllers.getSingleRoom,
);

router.post(
  '/create-room',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(RoomValidations.createRoomValidationSchema),
  RoomControllers.createRoom,
);

router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(RoomValidations.updateRoomValidationSchema),
  RoomControllers.updateRoom,
);

export const RoomRoutes = router;
