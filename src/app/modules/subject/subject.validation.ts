import { z } from 'zod';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
  SubjectTypes,
} from './subject.constant.js';

const requiredNumberSchema = (fieldName: string) =>
  z
    .number({
      error: `${fieldName} must be a valid number.`,
    })
    .finite(`${fieldName} must be a valid number.`);

const requiredPositiveNumberSchema = (fieldName: string) =>
  requiredNumberSchema(fieldName).positive(`${fieldName} must be greater than 0.`);

const requiredIntegerNumberSchema = (fieldName: string) =>
  requiredPositiveNumberSchema(fieldName).int(`${fieldName} must be a whole number.`);

const assessmentComponentValidationSchema = z.object({
  code: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  bucket: z.enum(AssessmentBuckets),
  componentType: z.enum(AssessmentComponentTypes),
  fullMarks: requiredNumberSchema('Assessment full marks').min(
    0,
    'Assessment full marks cannot be negative.',
  ),
  order: requiredIntegerNumberSchema('Assessment order').optional(),
  isRequired: z.boolean().optional(),
});

const markingSchemeValidationSchema = z.object({
  theoryContinuous: requiredNumberSchema('Theory continuous marks').min(
    0,
    'Theory continuous marks cannot be negative.',
  ),
  theoryFinal: requiredNumberSchema('Theory final marks').min(
    0,
    'Theory final marks cannot be negative.',
  ),
  practicalContinuous: requiredNumberSchema('Practical continuous marks').min(
    0,
    'Practical continuous marks cannot be negative.',
  ),
  practicalFinal: requiredNumberSchema('Practical final marks').min(
    0,
    'Practical final marks cannot be negative.',
  ),
  totalMarks: requiredNumberSchema('Total marks').min(
    0,
    'Total marks cannot be negative.',
  ),
});

const preRequisiteSubjectValidationSchema = z.object({
  subject: z.string(),
  isDeleted: z.boolean().optional(),
});

const createSubjectValidationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required.'),
    prefix: z.string().trim().min(1, 'Prefix is required.'),
    code: requiredIntegerNumberSchema('Code'),
    credits: requiredPositiveNumberSchema('Credits'),
    regulation: requiredIntegerNumberSchema('Regulation'),
    subjectType: z.enum(SubjectTypes),
    markingScheme: markingSchemeValidationSchema,
    assessmentComponents: z
      .array(assessmentComponentValidationSchema)
      .min(1, 'At least one assessment component is required.'),
    preRequisiteSubjects: z.array(preRequisiteSubjectValidationSchema).optional(),
    isDeleted: z.boolean().optional(),
  }),
});

const updateSubjectValidationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required.').optional(),
    prefix: z.string().trim().min(1, 'Prefix is required.').optional(),
    code: requiredIntegerNumberSchema('Code').optional(),
    credits: requiredPositiveNumberSchema('Credits').optional(),
    regulation: requiredIntegerNumberSchema('Regulation').optional(),
    subjectType: z.enum(SubjectTypes).optional(),
    markingScheme: markingSchemeValidationSchema.optional(),
    assessmentComponents: z
      .array(assessmentComponentValidationSchema)
      .min(1, 'At least one assessment component is required.')
      .optional(),
    preRequisiteSubjects: z.array(preRequisiteSubjectValidationSchema).optional(),
    isDeleted: z.boolean().optional(),
  }),
});

const instructorsWithSubjectValidationSchema = z.object({
  body: z.object({
    instructors: z.array(z.string()),
  }),
});

export const SubjectValidations = {
  createSubjectValidationSchema,
  updateSubjectValidationSchema,
  instructorsWithSubjectValidationSchema,
};
