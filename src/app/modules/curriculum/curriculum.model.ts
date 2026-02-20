import mongoose, { Schema } from 'mongoose';
import type { TCurriculum } from './curriculum.interface.js';

const curriculumSchema = new mongoose.Schema<TCurriculum>(
  {
    academicDepartment: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'AcademicDepartment',
    },
    academicSemester: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'AcademicSemester',
    },
    semisterRegistration: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'SemesterRegistration',
    },
    regulation: {
      type: Number,
      required: true,
    },
    session: {
      type: String,
      required: true,
      trim: true,
    },
    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
      },
    ],
    totalCredit: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

curriculumSchema.index(
  {
    academicDepartment: 1,
    academicSemester: 1,
    session: 1,
    semisterRegistration: 1,
  },
  { unique: true },
);

export const Curriculum = mongoose.model<TCurriculum>(
  'Curriculum',
  curriculumSchema,
);
