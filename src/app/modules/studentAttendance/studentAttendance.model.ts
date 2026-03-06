import mongoose, { Schema } from 'mongoose';
import type { TStudentAttendance } from './studentAttendance.interface.js';
import { StudentAttendanceStatus } from './studentAttendance.interface.js';

const studentAttendanceSchema = new Schema<TStudentAttendance>(
  {
    classSession: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'ClassSession',
    },
    offeredSubject: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'OfferedSubject',
    },
    enrolledSubject: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'EnrolledSubject',
    },
    student: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Student',
    },
    status: {
      type: String,
      enum: StudentAttendanceStatus,
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

studentAttendanceSchema.index({ classSession: 1, student: 1 }, { unique: true });
studentAttendanceSchema.index({ student: 1, offeredSubject: 1, status: 1 });
studentAttendanceSchema.index({ classSession: 1, status: 1 });

export const StudentAttendance = mongoose.model<TStudentAttendance>(
  'StudentAttendance',
  studentAttendanceSchema,
);
