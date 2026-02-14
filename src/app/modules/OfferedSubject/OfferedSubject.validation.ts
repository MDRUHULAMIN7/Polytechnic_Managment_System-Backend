import { z } from 'zod';
import { Days, timeToMinutes } from './OfferedSubject.constant.js';

const timeStringSchema = z.string().refine(
  (time) => {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/; // 00-09 10-19 20-23
    return regex.test(time);
  },
  {
    message: 'Invalid time format , expected "HH:MM" in 24 hours format',
  },
);
const COLLEGE_START_TIME = timeToMinutes('08:30');
const COLLEGE_END_TIME = timeToMinutes('18:45');
const MIN_CLASS_DURATION = 45;   // 1 period
const MAX_CLASS_DURATION = 135;  // 3 period (2h 15m)

const createOfferedSubjectValidationSchema = z.object({
  body: z
    .object({
      semesterRegistration: z.string(),
      academicInstructor: z.string(),
      academicDepartment: z.string(),
      subject: z.string(),
      instructor: z.string(),
      section: z.number(),
      maxCapacity: z.number(),
      days: z.array(z.enum([...Days] as [string, ...string[]])),
      startTime: timeStringSchema, // HH: MM   00-23: 00-59
      endTime: timeStringSchema,
    })
.refine(
  (body) => {
    const startMinutes = timeToMinutes(body.startTime);
    const endMinutes = timeToMinutes(body.endTime);
    const duration = endMinutes - startMinutes;

    return (
      startMinutes >= COLLEGE_START_TIME &&
      endMinutes <= COLLEGE_END_TIME &&
      endMinutes > startMinutes &&
      duration >= MIN_CLASS_DURATION &&
      duration <= MAX_CLASS_DURATION
    );
  },
  {
    message:
      'Class time must be between 08:30 and 18:45, duration must be between 45 minutes and 2 hours 15 minutes, and start time must be before end time (24-hour format)',
  },
)

});

const updateOfferedSubjectValidationSchema = z.object({
  body: z
    .object({
      instructor: z.string(),
      maxCapacity: z.number(),
      days: z.array(z.enum([...Days] as [string, ...string[]])),
      startTime: timeStringSchema, // HH: MM   00-23: 00-59
      endTime: timeStringSchema,
    })
.refine(
  (body) => {
    const startMinutes = timeToMinutes(body.startTime);
    const endMinutes = timeToMinutes(body.endTime);
    const duration = endMinutes - startMinutes;

    return (
      startMinutes >= COLLEGE_START_TIME &&
      endMinutes <= COLLEGE_END_TIME &&
      endMinutes > startMinutes &&
      duration >= MIN_CLASS_DURATION &&
      duration <= MAX_CLASS_DURATION
    );
  },
  {
    message:
      'Class time must be between 08:30 and 18:45, duration must be between 45 minutes and 2 hours 15 minutes, and start time must be before end time (24-hour format)',
  },
)

});

export const OfferedSubjectValidations = {
  createOfferedSubjectValidationSchema,
  updateOfferedSubjectValidationSchema,
};