import mongoose, { Schema } from 'mongoose';
import type { TSemesterRegistration } from './semesterRegistration.interface.js';
import { SemesterRegistrationShift, SemesterRegistrationStatus } from './semesterRegistration.constant.js';

const semesterRegistrationSchema = new mongoose.Schema<TSemesterRegistration>(
  {
    academicSemester: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: 'AcademicSemester',
    },
    status: {
      type: String,
      enum: SemesterRegistrationStatus,
      default: 'UPCOMING',
    },
    shift: {
      type: String,
      enum: SemesterRegistrationShift,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalCredit: {
      type: Number,
    }
  },
  {
    timestamps: true,
  },
);

export const SemesterRegistration = mongoose.model<TSemesterRegistration>(
  'SemesterRegistration',
  semesterRegistrationSchema,
);