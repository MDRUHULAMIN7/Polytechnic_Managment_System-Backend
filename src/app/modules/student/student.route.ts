import express from 'express';
import { studentControllers } from './student.controller.js';
import { studentValidations } from './student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
import auth from '../../middleware/auth.js';
const router = express.Router();


//route will be call controller function

router.get('/',auth('admin','instructor'),studentControllers.getAllStudents)
router.get('/:studentId',studentControllers.getSingleStudent)
router.patch('/:studentId',validateRequest(studentValidations.updateStudentValidationSchema),studentControllers.updateStudent)
router.delete('/:studentId',studentControllers.deleteStudent)

export const StudentRoutes = router;