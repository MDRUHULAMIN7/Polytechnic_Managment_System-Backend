import mongoose, { Schema } from 'mongoose';
import { Grade } from './enrolledSubject.constant.js';
import {
  EnrolledSubjectResultStatuses,
  type TEnrolledSubject,
  type TEnrolledSubjectAuditLog,
  type TEnrolledSubjectMarkEntry,
  type TEnrolledSubjectMarkSummary,
} from './enrolledSubject.interface.js';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
} from '../subject/subject.constant.js';
import { DEFAULT_MARK_SUMMARY } from './enrolledSubject.utils.js';

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

const markEntrySchema = new Schema<TEnrolledSubjectMarkEntry>(
  {
    componentCode: { type: String, required: true, trim: true },
    componentTitle: { type: String, required: true, trim: true },
    bucket: { type: String, enum: AssessmentBuckets, required: true },
    componentType: {
      type: String,
      enum: AssessmentComponentTypes,
      required: true,
    },
    fullMarks: { type: Number, required: true, min: 0 },
    order: { type: Number, required: true, min: 1 },
    isRequired: { type: Boolean, default: true },
    obtainedMarks: { type: Number, default: null, min: 0 },
    isReleased: { type: Boolean, default: false },
    releasedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    lastUpdatedAt: { type: Date, default: null },
    lastUpdatedBy: { type: String, default: null },
  },
  {
    _id: false,
  },
);

const auditLogSchema = new Schema<TEnrolledSubjectAuditLog>(
  {
    componentCode: { type: String, required: true, trim: true },
    componentTitle: { type: String, required: true, trim: true },
    oldValue: { type: Number, default: null },
    newValue: { type: Number, default: null },
    reason: { type: String, default: '' },
    actorId: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    changedAt: { type: Date, required: true },
  },
  {
    _id: false,
  },
);

const markSummarySchema = new Schema<TEnrolledSubjectMarkSummary>(
  {
    theoryContinuous: { type: Number, default: 0, min: 0 },
    theoryFinal: { type: Number, default: 0, min: 0 },
    practicalContinuous: { type: Number, default: 0, min: 0 },
    practicalFinal: { type: Number, default: 0, min: 0 },
    releasedTheoryContinuous: { type: Number, default: 0, min: 0 },
    releasedTheoryFinal: { type: Number, default: 0, min: 0 },
    releasedPracticalContinuous: { type: Number, default: 0, min: 0 },
    releasedPracticalFinal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    releasedTotal: { type: Number, default: 0, min: 0 },
    totalMarks: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0 },
    releasedPercentage: { type: Number, default: 0, min: 0 },
    releasedMarks: { type: Number, default: 0, min: 0 },
  },
  {
    _id: false,
  },
);

const enrolledSubjectSchema = new Schema<TEnrolledSubject>({
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
  academicInstructor: {
    type: Schema.Types.ObjectId,
    ref: 'AcademicInstructor',
    required: true,
  },
  academicDepartment: {
    type: Schema.Types.ObjectId,
    ref: 'AcademicDepartment',
    required: true,
  },
  offeredSubject: {
    type: Schema.Types.ObjectId,
    ref: 'OfferedSubject',
    required: true,
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  instructor: {
    type: Schema.Types.ObjectId,
    ref: 'Instructor',
    required: true,
  },
  isEnrolled: {
    type: Boolean,
    default: false,
  },
  markingSchemeSnapshot: {
    type: markingSchemeSnapshotSchema,
    required: true,
  },
  markEntries: {
    type: [markEntrySchema],
    default: [],
  },
  markSummary: {
    type: markSummarySchema,
    default: DEFAULT_MARK_SUMMARY,
  },
  auditLogs: {
    type: [auditLogSchema],
    default: [],
  },
  resultStatus: {
    type: String,
    enum: EnrolledSubjectResultStatuses,
    default: 'IN_PROGRESS',
  },
  grade: {
    type: String,
    enum: Grade,
    default: 'NA',
  },
  gradePoints: {
    type: Number,
    min: 0,
    max: 4,
    default: 0,
  },
  finalResultPublishedAt: {
    type: Date,
    default: null,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
});

enrolledSubjectSchema.index(
  {
    semesterRegistration: 1,
    offeredSubject: 1,
    student: 1,
  },
  { unique: true },
);

const EnrolledSubject = mongoose.model<TEnrolledSubject>(
  'EnrolledSubject',
  enrolledSubjectSchema,
);

export default EnrolledSubject;
