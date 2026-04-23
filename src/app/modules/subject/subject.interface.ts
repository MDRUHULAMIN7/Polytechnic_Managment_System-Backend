import { Types } from 'mongoose';
import {
  AssessmentBuckets,
  AssessmentComponentTypes,
  SubjectTypes,
} from './subject.constant.js';

export type TSubjectType = (typeof SubjectTypes)[number];
export type TAssessmentBucket = (typeof AssessmentBuckets)[number];
export type TAssessmentComponentType = (typeof AssessmentComponentTypes)[number];

export type TPreRequisiteSubject = {
  subject: Types.ObjectId;
  isDeleted: boolean;
};

export type TSubjectMarkingScheme = {
  theoryContinuous: number;
  theoryFinal: number;
  practicalContinuous: number;
  practicalFinal: number;
  totalMarks: number;
};

export type TAssessmentComponent = {
  code: string;
  title: string;
  bucket: TAssessmentBucket;
  componentType: TAssessmentComponentType;
  fullMarks: number;
  order: number;
  isRequired: boolean;
};

export type TSubject = {
  title: string;
  prefix: string;
  code: number;
  credits: number;
  regulation: number;
  subjectType: TSubjectType;
  markingScheme: TSubjectMarkingScheme;
  assessmentComponents: TAssessmentComponent[];
  preRequisiteSubjects: TPreRequisiteSubject[];
  isDeleted?: boolean;
};

export type TSubjectInstructor = {
  subject: Types.ObjectId;
  instructors: [Types.ObjectId];
};
