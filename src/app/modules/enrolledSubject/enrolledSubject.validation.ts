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
      classTest1: z.number().min(0).max(10).optional(),
      midTerm: z.number().min(0).max(30).optional(),
      classTest2: z.number().min(0).max(10).optional(),
      finalTerm: z.number().min(0).max(90).optional(),
    }),
  }),
});

export const EnrolledSubjectValidations = {
  createEnrolledSubjectValidationZodSchema,
  updateEnrolledSubjectMarksValidationZodSchema,
};
