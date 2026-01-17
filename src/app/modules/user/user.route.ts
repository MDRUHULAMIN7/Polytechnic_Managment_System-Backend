import express from 'express';
import { userControllers } from './user.controller.js';

// import type { AnyZodObject } from 'zod/v3';
import { studentValidations } from '../student/student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
const router = express.Router();



//route will be call controller function
router.post('/create-student',validateRequest(studentValidations.createStudentZodValidationSchema) ,userControllers.createStudent)

export const UserRoutes = router;