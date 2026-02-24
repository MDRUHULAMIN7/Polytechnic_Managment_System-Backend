import { z } from 'zod';

const createSemesterEnrollmentValidationSchema = z.object({
  body: z.object({
    curriculum: z.string(),
  }),
});

export const SemesterEnrollmentValidations = {
  createSemesterEnrollmentValidationSchema,
};
