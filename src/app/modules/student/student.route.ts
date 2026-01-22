import express from 'express';
import { studentControllers } from './student.controller.js';
import { studentValidations } from './student.validation.js';
import validateRequest from '../../middleware/validateRequest.js';
const router = express.Router();


//route will be call controller function

router.get('/',studentControllers.getAllStudents)
router.get('/:studentId',studentControllers.getSingleStudent)
router.patch('/:studentId',validateRequest(studentValidations.updateStudentValidationSchema),studentControllers.updateStudent)
router.delete('/:studentId',studentControllers.deleteStudent)

export const StudentRoutes = router;