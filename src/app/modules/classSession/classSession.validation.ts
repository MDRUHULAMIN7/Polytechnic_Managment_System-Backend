import { z } from 'zod';

const syncClassSessionsValidationSchema = z.object({
  body: z.object({
    offeredSubjectId: z.string().optional(),
    replaceScheduled: z.boolean().optional(),
  }),
});

const startClassSessionValidationSchema = z.object({
  body: z.object({
    topic: z.string().trim().min(1).max(200).optional(),
    remarks: z.string().trim().max(500).optional(),
  }),
});

export const ClassSessionValidations = {
  syncClassSessionsValidationSchema,
  startClassSessionValidationSchema,
};
