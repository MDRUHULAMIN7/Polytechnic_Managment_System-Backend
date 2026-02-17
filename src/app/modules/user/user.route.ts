import express, { type NextFunction, type Request, type Response } from 'express';
import { userControllers } from './user.controller.js';

// import type { AnyZodObject } from 'zod/v3';
import { studentValidations } from '../student/student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import { instructorValidations } from '../Instructor/Instructor.validation.js';
import { AdminValidations } from '../admin/admin.validation.js';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from './user.constant.js';
import { UserValidation } from './user.validation.js';
import { upload } from '../../utils/sendImageToCloudinary.js';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
const router = express.Router();



//route will be call controller function
router.post('/create-student',auth(USER_ROLE.admin),
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    const { data, student, password } = req.body ?? {};
    try {
      if (typeof data === 'string') {
        req.body = JSON.parse(data);
        next();
        return;
      }

      if (typeof student === 'string') {
        req.body = { password, student: JSON.parse(student) };
        next();
        return;
      }

      if (typeof student === 'object' && student !== null) {
        req.body = { password, student };
        next();
        return;
      }

      next(
        new AppError(
          StatusCodes.BAD_REQUEST,
          'Invalid request body. Send form-data field "data" as JSON string, or send "student" as JSON string.',
        ),
      );
    } catch {
      next(
        new AppError(
          StatusCodes.BAD_REQUEST,
          'Invalid JSON in form-data. Check "data" or "student" field.',
        ),
      );
    }
  },
validateRequest(studentValidations.createStudentZodValidationSchema),
userControllers.createStudent);

router.post('/create-instructor',auth(USER_ROLE.admin),validateRequest(instructorValidations.createInstructorValidationSchema) ,userControllers.createInstructor);

router.post('/create-admin',validateRequest(AdminValidations.createAdminValidationSchema) ,userControllers.createAdmin);
router.post(
  '/change-status/:id',
  auth('admin'),
  validateRequest(UserValidation.changeStatusValidationSchema),
  userControllers.changeStatus,
);

router.get('/me',auth('admin','instructor','student') ,userControllers.getMe);

export const UserRoutes = router;
