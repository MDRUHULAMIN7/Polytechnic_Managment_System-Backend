import { z } from 'zod';
import { timeToMinutes } from './periodConfig.constant.js';

const timeStringSchema = z.string().refine(
  (time) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time),
  {
    message: 'Invalid time format. Expected HH:MM in 24-hour format.',
  },
);

const periodItemSchema = z
  .object({
    periodNo: z
      .number({ error: 'Period number must be a valid number.' })
      .int('Period number must be a whole number.')
      .positive('Period number must be greater than 0.'),
    title: z.string().trim().optional(),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    durationMinutes: z
      .number({ error: 'Duration must be a valid number.' })
      .int('Duration must be a whole number.')
      .positive('Duration must be greater than 0.'),
    isBreak: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      timeToMinutes(value.endTime) > timeToMinutes(value.startTime) &&
      timeToMinutes(value.endTime) - timeToMinutes(value.startTime) ===
        value.durationMinutes,
    {
      message:
        'Period end time must be later than start time and duration must match the time range.',
    },
  );

const basePeriodConfigSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.'),
  effectiveFrom: z.string().trim().min(1, 'Effective date is required.'),
  isActive: z.boolean().optional(),
  periods: z
    .array(periodItemSchema)
    .min(1, 'At least one period is required.')
    .superRefine((periods, ctx) => {
      const seen = new Set<number>();
      const sorted = [...periods].sort((left, right) => left.periodNo - right.periodNo);

      sorted.forEach((period, index) => {
        if (seen.has(period.periodNo)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Period ${period.periodNo} is duplicated.`,
            path: [index, 'periodNo'],
          });
        }
        seen.add(period.periodNo);
      });

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];

        if (timeToMinutes(current.startTime) < timeToMinutes(previous.endTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Period ${current.periodNo} overlaps with period ${previous.periodNo}.`,
            path: [index, 'startTime'],
          });
        }
      }
    }),
});

const createPeriodConfigValidationSchema = z.object({
  body: basePeriodConfigSchema,
});

const updatePeriodConfigValidationSchema = z.object({
  body: basePeriodConfigSchema,
});

export const PeriodConfigValidations = {
  createPeriodConfigValidationSchema,
  updatePeriodConfigValidationSchema,
};
