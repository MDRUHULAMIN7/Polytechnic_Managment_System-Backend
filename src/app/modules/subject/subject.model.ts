import { Schema, model, Types } from 'mongoose';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
  SubjectTypes,
} from './subject.constant.js';
import {
  type TAssessmentComponent,
  type TSubjectInstructor,
  type TSubject,
  type TSubjectMarkingScheme,
} from './subject.interface.js';

const PreRequisiteSubjectSchema = new Schema(
  {
    subject: { type: Types.ObjectId, ref: 'Subject', required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    _id: false,
  },
);

const SubjectMarkingSchemeSchema = new Schema<TSubjectMarkingScheme>(
  {
    theoryContinuous: { type: Number, required: true, min: 0, default: 0 },
    theoryFinal: { type: Number, required: true, min: 0, default: 0 },
    practicalContinuous: { type: Number, required: true, min: 0, default: 0 },
    practicalFinal: { type: Number, required: true, min: 0, default: 0 },
    totalMarks: { type: Number, required: true, min: 0 },
  },
  {
    _id: false,
  },
);

const AssessmentComponentSchema = new Schema<TAssessmentComponent>(
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
  {
    _id: false,
  },
);

const SubjectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, unique: true },
    prefix: { type: String, trim: true, required: true },
    code: { type: Number, required: true, trim: true, unique: true },
    credits: { type: Number, required: true, min: 0 },
    regulation: { type: Number, required: true },
    subjectType: { type: String, enum: SubjectTypes, required: true },
    markingScheme: {
      type: SubjectMarkingSchemeSchema,
      required: true,
    },
    assessmentComponents: {
      type: [AssessmentComponentSchema],
      default: [],
    },
    preRequisiteSubjects: { type: [PreRequisiteSubjectSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

export const Subject = model<TSubject>('Subject', SubjectSchema);

const SubjectInstructorSchema = new Schema({
  subject: { type: Types.ObjectId, ref: 'Subject', required: true, unique: true },
  instructors: { type: [Types.ObjectId], ref: 'Instructor', default: [] },
});

export const SubjectInstructor = model<TSubjectInstructor>(
  'SubjectInstructor',
  SubjectInstructorSchema,
);
