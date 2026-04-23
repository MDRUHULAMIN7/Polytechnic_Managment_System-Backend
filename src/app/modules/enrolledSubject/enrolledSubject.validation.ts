import { z } from 'zod';

const createEnrolledSubjectValidationZodSchema = z.object({
  body: z.object({
    offeredSubject: z.string(),
  }),
});

const updateEnrolledSubjectMarksValidationZodSchema = z.object({
  body: z.object({
    offeredSubject: z.string(),
    student: z.string(),
    entries: z
      .array(
        z.object({
          componentCode: z.string().trim().min(1),
          obtainedMarks: z.number().min(0).nullable(),
          remarks: z.string().trim().optional(),
        }),
      )
      .min(1),
    reason: z.string().trim().optional(),
  }),
});

const releaseEnrolledSubjectComponentValidationZodSchema = z.object({
  body: z.object({
    offeredSubject: z.string(),
    componentCode: z.string().trim().min(1),
  }),
});

const publishFinalResultValidationZodSchema = z.object({
  body: z.object({
    offeredSubject: z.string(),
  }),
});

export const EnrolledSubjectValidations = {
  createEnrolledSubjectValidationZodSchema,
  updateEnrolledSubjectMarksValidationZodSchema,
  releaseEnrolledSubjectComponentValidationZodSchema,
  publishFinalResultValidationZodSchema,
};
