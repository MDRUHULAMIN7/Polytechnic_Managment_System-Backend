import { z } from 'zod';

// PreRequisiteSubject Validation
const PreRequisiteSubjectValidationSchema = z.object({
  subject: z.string(), // ObjectId string
  isDeleted: z.boolean().optional(),
});

// Create Subject Validation
const createSubjectValidationSchema = z.object({
  body: z.object({
    title: z.string(),
    prefix: z.string(),
    code: z.number(),
    credits: z.number(),
    regulation: z.number(),
    preRequisiteSubjects: z.array(PreRequisiteSubjectValidationSchema).optional(),
    isDeleted: z.boolean().optional(),
  }),
});

// Update PreRequisiteSubject Validation
const updatePreRequisiteSubjectValidationSchema = z.object({
  subject: z.string(),
  isDeleted: z.boolean().optional(),
});

// Update Subject Validation
const updateSubjectValidationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    prefix: z.string().optional(),
    code: z.number().optional(),
    credits: z.number().optional(),
    regulation: z.number().optional(),
    preRequisiteSubjects: z
      .array(updatePreRequisiteSubjectValidationSchema)
      .optional(),
    isDeleted: z.boolean().optional(),
  }),
});

// Instructors Assignment Validation
const instructorsWithSubjectValidationSchema = z.object({
  body: z.object({
    instructors: z.array(z.string()), // array of instructor ObjectId strings
  }),
});

// Export Subject Validations
export const SubjectValidations = {
  createSubjectValidationSchema,
  updateSubjectValidationSchema,
  instructorsWithSubjectValidationSchema,
};
