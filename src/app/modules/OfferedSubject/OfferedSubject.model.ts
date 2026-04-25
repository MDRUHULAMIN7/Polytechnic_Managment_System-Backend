import mongoose, { Schema } from 'mongoose';
import { Days, OfferedSubjectClassTypes } from './OfferedSubject.constant.js';
import {
  OfferedSubjectMarkingStatuses,
  type TOfferedSubject,
  type TScheduleBlock,
} from './OfferedSubject.interface.js';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
} from '../subject/subject.constant.js';

const markingSchemeSnapshotSchema = new Schema(
  {
    theoryContinuous: { type: Number, required: true, min: 0, default: 0 },
    theoryFinal: { type: Number, required: true, min: 0, default: 0 },
    practicalContinuous: { type: Number, required: true, min: 0, default: 0 },
    practicalFinal: { type: Number, required: true, min: 0, default: 0 },
    totalMarks: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const assessmentComponentSnapshotSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    bucket: { type: String, enum: AssessmentBuckets, required: true },
    componentType: {
      type: String,
      enum: AssessmentComponentTypes,
      required: true,
    },
    fullMarks: { type: Number, required: true, min: 0 },
    order: { type: Number, required: true, min: 1 },
    isRequired: { type: Boolean, default: true },
  },
  { _id: false },
);

const scheduleBlockSchema = new Schema<TScheduleBlock>(
  {
    classType: {
      type: String,
      enum: OfferedSubjectClassTypes,
      required: true,
    },
    day: {
      type: String,
      enum: Days,
      required: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    startPeriod: {
      type: Number,
      required: true,
      min: 1,
    },
    periodCount: {
      type: Number,
      required: true,
      min: 1,
    },
    periodNumbers: {
      type: [Number],
      default: [],
    },
    startTimeSnapshot: {
      type: String,
      required: true,
    },
    endTimeSnapshot: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

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
    scheduleBlocks: {
      type: [scheduleBlockSchema],
      default: [],
    },
    markingSchemeSnapshot: {
      type: markingSchemeSnapshotSchema,
      required: true,
    },
    assessmentComponentsSnapshot: {
      type: [assessmentComponentSnapshotSchema],
      default: [],
    },
    releasedComponentCodes: {
      type: [String],
      default: [],
    },
    finalResultPublishedAt: {
      type: Date,
      default: null,
    },
    markingStatus: {
      type: String,
      enum: OfferedSubjectMarkingStatuses,
      default: 'NOT_STARTED',
    },
  },
  {
    timestamps: true,
  },
);

offeredSubjectSchema.index(
  { semesterRegistration: 1, subject: 1 },
  { unique: true },
);
offeredSubjectSchema.index({ semesterRegistration: 1, instructor: 1 });
offeredSubjectSchema.index({ semesterRegistration: 1, academicDepartment: 1 });
offeredSubjectSchema.index({ 'scheduleBlocks.room': 1 });

export const OfferedSubject = mongoose.model<TOfferedSubject>(
  'OfferedSubject',
  offeredSubjectSchema,
);
