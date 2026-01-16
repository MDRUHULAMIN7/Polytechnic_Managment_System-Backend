import express from 'express';
import { userControllers } from './user.controller.js';
const router = express.Router();


//route will be call controller function
router.post('/create-student',userControllers.createStudent)

export const UserRoutes = router;