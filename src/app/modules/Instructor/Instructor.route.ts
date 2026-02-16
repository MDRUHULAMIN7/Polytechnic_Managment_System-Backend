import express from 'express';
import { InstructorControllers } from './Instructor.controller.js';
import validateRequest from '../../middleware/validateRequest.js';
import { updateInstructorValidationSchema } from './Instructor.validation.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';

const router = express.Router();

router.get('/:id', InstructorControllers.getSingleInstructor);

router.patch(
  '/:id',
  validateRequest(updateInstructorValidationSchema),
  InstructorControllers.updateInstructor,
);

router.delete('/:id', InstructorControllers.deleteInstructor);

router.get('/',auth(USER_ROLE.admin), InstructorControllers.getAllInstructors);

export const InstructorRoutes = router;