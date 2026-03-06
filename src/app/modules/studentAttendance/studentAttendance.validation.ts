import { z } from 'zod';

const attendanceRowSchema = z.object({
  studentId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LEAVE']),
  remarks: z.string().trim().max(300).nullable().optional(),
});

const submitStudentAttendanceValidationSchema = z.object({
  body: z.object({
    classSessionId: z.string(),
    attendance: z.array(attendanceRowSchema).min(1),
  }),
});

const updateStudentAttendanceValidationSchema = z.object({
  body: z.object({
    status: z.enum(['PRESENT', 'ABSENT', 'LEAVE']),
    remarks: z.string().trim().max(300).nullable().optional(),
  }),
});

export const StudentAttendanceValidations = {
  submitStudentAttendanceValidationSchema,
  updateStudentAttendanceValidationSchema,
};
