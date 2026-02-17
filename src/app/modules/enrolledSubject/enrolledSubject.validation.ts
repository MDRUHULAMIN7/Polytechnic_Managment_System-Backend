import { z } from 'zod';

const createEnrolledSubjectValidationZodSchema = z.object({
  body: z.object({
    offeredSubject: z.string(),
  }),
});

const updateEnrolledSubjectMarksValidationZodSchema = z.object({
  body: z.object({
    semesterRegistration: z.string(),
    offeredSubject: z.string(),
    student: z.string(),
    subjectMarks: z.object({
      classTest1: z.number().optional(),
      midTerm: z.number().optional(),
      classTest2: z.number().optional(),
      finalTerm: z.number().optional(),
    }),
  }),
});

export const EnrolledSubjectValidations = {
  createEnrolledSubjectValidationZodSchema,
  updateEnrolledSubjectMarksValidationZodSchema,
};