import { z } from 'zod';

const createAcademicInstructorValidationSchema = z.object({
  body: z.object({
    name: z.string(),
  }),
});

const updateAcademicInstructorValidationSchema = z.object({
  body: z.object({
    name: z.string(),
  }),
});

export const AcademicInstructorValidation = {
  createAcademicInstructorValidationSchema,
  updateAcademicInstructorValidationSchema,
};