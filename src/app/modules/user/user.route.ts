import express from 'express';
import { userControllers } from './user.controller.js';

// import type { AnyZodObject } from 'zod/v3';
import { studentValidations } from '../student/student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import { instructorValidations } from '../Instructor/Instructor.validation.js';
import { AdminValidations } from '../admin/admin.validation.js';
const router = express.Router();



//route will be call controller function
router.post('/create-student',validateRequest(studentValidations.createStudentZodValidationSchema) ,userControllers.createStudent);
router.post('/create-instructor',validateRequest(instructorValidations.createInstructorValidationSchema) ,userControllers.createInstructor);
router.post('/create-admin',validateRequest(AdminValidations.createAdminValidationSchema) ,userControllers.createAdmin);

export const UserRoutes = router;