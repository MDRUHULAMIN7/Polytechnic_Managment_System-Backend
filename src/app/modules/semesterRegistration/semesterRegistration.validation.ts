import { z } from 'zod';
import { SemesterRegistrationShift, SemesterRegistrationStatus } from './semesterRegistration.constant.js';

const createSemesterRegistrationValidationSchema = z.object({
  body: z.object({
    academicSemester: z.string(),
    status: z.enum([...(SemesterRegistrationStatus as [string, ...string[]])]),
    shift: z.enum([...(SemesterRegistrationShift as [string, ...string[]])]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    totalCredit: z.number()
  }),
});

const upadateSemesterRegistrationValidationSchema = z.object({
  body: z.object({
    academicSemester: z.string().optional(),
    status: z
      .enum([...(SemesterRegistrationStatus as [string, ...string[]])])
      .optional(),
    shift: z
      .enum([...(SemesterRegistrationShift as [string, ...string[]])])
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    totalCredit: z.number().optional()
  }),
});

export const SemesterRegistrationValidations = {
  createSemesterRegistrationValidationSchema,
  upadateSemesterRegistrationValidationSchema,
};