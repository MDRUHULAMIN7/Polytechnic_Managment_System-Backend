import express from 'express';
import { AcademicSemesterControllers } from './academicSemester.controller.js';
import { academicSemesterValidationSchema } from './academicSemester.validation.js';
import validateRequest from '../../middleware/validateRequest.js';

const router = express.Router();


router.post('/create-academic-semester',validateRequest(academicSemesterValidationSchema.createAcademicSemesterValidationSchema),AcademicSemesterControllers.createAcademicSemester)

export const AcademicSemsterRoutes = router;