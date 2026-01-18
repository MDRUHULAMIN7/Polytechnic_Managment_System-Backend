import { model, Schema } from 'mongoose';
import type { TAcademicInstructor } from './academicInstructor.interface.js';

const academicInstructorSchema = new Schema<TAcademicInstructor>(
  {
    name: {
      type: String,
      required: true,
      unique:true
    },
  },
  {
    timestamps: true,
  },
);

export const AcademicInstructor = model<TAcademicInstructor>(
  'AcademicInstructor',
  academicInstructorSchema,
);
