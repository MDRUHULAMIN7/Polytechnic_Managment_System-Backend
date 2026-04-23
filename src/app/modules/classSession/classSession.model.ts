import mongoose, { Schema } from 'mongoose';
import type { TClassSession } from './classSession.interface.js';
import { ClassSessionStatus } from './classSession.interface.js';
import { Days } from '../OfferedSubject/OfferedSubject.constant.js';

const classSessionSchema = new Schema<TClassSession>(
  {
    offeredSubject: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'OfferedSubject',
    },
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
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    classType: {
      type: String,
      enum: ['theory', 'practical', 'tutorial'],
    },
    sessionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    date: {
      type: Date,
      required: true,
    },
    day: {
      type: String,
      enum: Days,
      required: true,
    },
    startPeriod: {
      type: Number,
      min: 1,
    },
    periodCount: {
      type: Number,
      min: 1,
    },
    periodNumbers: {
      type: [Number],
      default: [],
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ClassSessionStatus,
      default: 'SCHEDULED',
      required: true,
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    absentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    leaveCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    instructorCheckInTime: {
      type: Date,
    },
    instructorCheckOutTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

classSessionSchema.index(
  { offeredSubject: 1, date: 1, startTime: 1, room: 1 },
  { unique: true },
);
classSessionSchema.index({ instructor: 1, date: 1, status: 1 });
classSessionSchema.index({ date: 1, status: 1 });
classSessionSchema.index({ semesterRegistration: 1, status: 1 });

export const ClassSession = mongoose.model<TClassSession>(
  'ClassSession',
  classSessionSchema,
);
