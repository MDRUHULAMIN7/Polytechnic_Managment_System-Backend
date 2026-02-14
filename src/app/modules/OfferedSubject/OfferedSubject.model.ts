import mongoose, { Schema } from 'mongoose';
import { Days } from './OfferedSubject.constant.js';
import type{ TOfferedSubject } from './OfferedSubject.interface.js';

const offeredSubjectSchema = new mongoose.Schema<TOfferedSubject>(
  {
    semesterRegistration: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SemesterRegistration',
    },
    academicSemester: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'AcademicSemester',
    },
    academicInstructor: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'AcademicInstructor',
    },
    academicDepartment: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'AcademicDepartment',
    },
    subject: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Subject',
    },
    instructor: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Instructor',
    },
    maxCapacity: {
      type: Number,
      required: true,
    },
    section: {
      type: Number,
      unique:true,
      required: true,
    },
    days: [
      {
        type: String,
        enum: Days,
      },
    ],
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const OfferedSubject = mongoose.model<TOfferedSubject>(
  'OfferedSubject',
  offeredSubjectSchema,
);