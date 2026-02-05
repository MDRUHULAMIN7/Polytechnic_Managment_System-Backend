import { Schema, model, Types } from 'mongoose';
import type{ TSubject } from './subject.interface.js';

const PreRequisiteSubjectSchema = new Schema(
  {
    subject: { type: Types.ObjectId, ref: 'Subject', required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    _id: false,
  },
);

const SubjectSchema = new Schema({
  title: { type: String, required: true, trim: true, unique: true },
  prefix: { type: String, trim: true, required: true },
  code: { type: Number, required: true,trim: true, unique: true },
  credits: { type: Number, required: true },
  regulation: { type: Number, required: true },
  preRequisiteSubjects: { type: [PreRequisiteSubjectSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
});

export const Subject = model<TSubject>('Subject', SubjectSchema);

const SubjectInstructorSchema = new Schema({
  subject: { type: Types.ObjectId, ref: 'Subject', required: true },
  instructors: { type: [Types.ObjectId], ref: 'Instructor', default: [] },
});

export const SubjectInstructor = model(
  'SubjectInstructor',
  SubjectInstructorSchema,
);
