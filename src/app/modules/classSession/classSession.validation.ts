import { z } from 'zod';

const syncClassSessionsValidationSchema = z.object({
  body: z.object({
    offeredSubjectId: z.string().optional(),
    curriculumId: z.string().optional(),
    replaceScheduled: z.boolean().optional(),
  }),
});

const startClassSessionValidationSchema = z.object({
  body: z.object({
    topic: z.string().trim().min(1).max(200).optional(),
    remarks: z.string().trim().max(500).optional(),
  }),
});

const rescheduleClassSessionValidationSchema = z.object({
  body: z.object({
    date: z.string().trim().min(1),
    startTime: z.string().trim().min(1),
    endTime: z.string().trim().min(1),
  }),
});

export const ClassSessionValidations = {
  syncClassSessionsValidationSchema,
  startClassSessionValidationSchema,
  rescheduleClassSessionValidationSchema,
};
