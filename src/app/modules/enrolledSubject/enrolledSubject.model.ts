import mongoose, { Schema } from 'mongoose';
import { Grade } from './enrolledSubject.constant.js';
import type{
  TEnrolledSubject,
  TEnrolledSubjectMarks,
} from './enrolledSubject.interface.js';

const SubjectMarksSchema = new Schema<TEnrolledSubjectMarks>(
  {
    classTest1: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    midTerm: {
      type: Number,
      min: 0,
      max: 30,
      default: 0,
    },
    classTest2: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    finalTerm: {
      type: Number,
      min: 0,
      max: 90,
      default: 0,
    },
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
  subjectMarks: {
    type: SubjectMarksSchema,
    default: {},
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
  isCompleted: {
    type: Boolean,
    default: false,
  },
});

const EnrolledSubject = mongoose.model<TEnrolledSubject>(
  'EnrolledSubject',
  enrolledSubjectSchema,
);

export default EnrolledSubject;
