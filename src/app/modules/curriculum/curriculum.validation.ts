import { z } from 'zod';

const sessionValidationSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Session must be in format "YYYY-YYYY"');

const createCurriculumValidationSchema = z.object({
  body: z.object({
    academicDepartment: z.string(),
    semisterRegistration: z.string(),
    regulation: z.number(),
    session: sessionValidationSchema,
    subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  }),
});

const updateCurriculumValidationSchema = z.object({
  body: z
    .object({
      academicDepartment: z.string().optional(),
      academicSemester: z.string().optional(),
      semisterRegistration: z.string().optional(),
      regulation: z.number().optional(),
      session: sessionValidationSchema.optional(),
      subjects: z.array(z.string()).optional(),
      totalCredit: z.number().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required for update',
    }),
});

export const CurriculumValidations = {
  createCurriculumValidationSchema,
  updateCurriculumValidationSchema,
};
