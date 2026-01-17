import express from 'express';
import { studentControllers } from './student.controller.js';
const router = express.Router();


//route will be call controller function

router.get('/',studentControllers.getAllStudents)
router.get('/:studentId',studentControllers.getSingleStudent)
router.delete('/:studentId',studentControllers.deleteStudent)

export const StudentRoutes = router;