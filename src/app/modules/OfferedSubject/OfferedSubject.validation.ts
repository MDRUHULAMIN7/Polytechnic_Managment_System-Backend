import { z } from 'zod';
import { Days, OfferedSubjectClassTypes } from './OfferedSubject.constant.js';

const positiveIntegerSchema = (fieldName: string) =>
  z
    .number({
      error: `${fieldName} must be a valid number.`,
    })
    .int(`${fieldName} must be a whole number.`)
    .positive(`${fieldName} must be greater than 0.`);

const scheduleBlockSchema = z.object({
  classType: z.enum(OfferedSubjectClassTypes),
  day: z.enum([...Days] as [string, ...string[]]),
  room: z.string().trim().min(1, 'Room is required.'),
  startPeriod: positiveIntegerSchema('Start period'),
  periodCount: positiveIntegerSchema('Period count'),
});

const createOfferedSubjectValidationSchema = z.object({
  body: z.object({
    semesterRegistration: z.string(),
    academicInstructor: z.string(),
    academicDepartment: z.string(),
    subject: z.string(),
    instructor: z.string(),
    section: positiveIntegerSchema('Section'),
    maxCapacity: positiveIntegerSchema('Max capacity'),
    scheduleBlocks: z
      .array(scheduleBlockSchema)
      .min(1, 'At least one schedule block is required.'),
  }),
});

const updateOfferedSubjectValidationSchema = z.object({
  body: z.object({
    instructor: z.string(),
    maxCapacity: positiveIntegerSchema('Max capacity'),
    scheduleBlocks: z
      .array(scheduleBlockSchema)
      .min(1, 'At least one schedule block is required.'),
  }),
});

const previewOfferedSubjectConflictValidationSchema = z.object({
  body: z.object({
    semesterRegistration: z.string(),
    academicDepartment: z.string(),
    instructor: z.string(),
    maxCapacity: positiveIntegerSchema('Max capacity'),
    scheduleBlocks: z
      .array(scheduleBlockSchema)
      .min(1, 'At least one schedule block is required.'),
    excludeOfferedSubjectId: z.string().optional(),
  }),
});

export const OfferedSubjectValidations = {
  createOfferedSubjectValidationSchema,
  updateOfferedSubjectValidationSchema,
  previewOfferedSubjectConflictValidationSchema,
};
