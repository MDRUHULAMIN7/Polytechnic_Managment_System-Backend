import mongoose, { Schema } from 'mongoose';
import type { TSemesterEnrollment } from './semesterEnrollment.interface.js';
import { EnrollmentStatus } from './semesterEnrollment.constant.js';

const semesterEnrollmentSchema = new mongoose.Schema<TSemesterEnrollment>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    curriculum: {
      type: Schema.Types.ObjectId,
      ref: 'Curriculum',
      required: true,
    },
    semesterRegistration: {
      type: Schema.Types.ObjectId,
      ref: 'SemesterRegistration',
      required: true,
    },
    academicSemester: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSemester',
      required: true,
    },
    academicDepartment: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicDepartment',
      required: true,
    },
    status: {
      type: String,
      enum: EnrollmentStatus,
      default: 'PENDING',
      required: true,
    },
    fees: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isPaid: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

semesterEnrollmentSchema.index(
  {
    student: 1,
    semesterRegistration: 1,
  },
  { unique: true },
);

export const SemesterEnrollment = mongoose.model<TSemesterEnrollment>(
  'SemesterEnrollment',
  semesterEnrollmentSchema,
);
