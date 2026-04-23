import { Types } from 'mongoose';
import type {
  TAssessmentBucket,
  TAssessmentComponentType,
  TSubjectMarkingScheme,
} from '../subject/subject.interface.js';

export type TGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'NA';

export const EnrolledSubjectResultStatuses = [
  'IN_PROGRESS',
  'PARTIAL_RELEASED',
  'FINAL_READY',
  'FINAL_PUBLISHED',
] as const;

export type TEnrolledSubjectResultStatus =
  (typeof EnrolledSubjectResultStatuses)[number];

export type TEnrolledSubjectMarkEntry = {
  componentCode: string;
  componentTitle: string;
  bucket: TAssessmentBucket;
  componentType: TAssessmentComponentType;
  fullMarks: number;
  order: number;
  isRequired: boolean;
  obtainedMarks: number | null;
  isReleased: boolean;
  releasedAt?: Date | null;
  remarks?: string;
  lastUpdatedAt?: Date | null;
  lastUpdatedBy?: string | null;
};

export type TEnrolledSubjectAuditLog = {
  componentCode: string;
  componentTitle: string;
  oldValue: number | null;
  newValue: number | null;
  reason?: string;
  actorId: string;
  actorRole: string;
  changedAt: Date;
};

export type TEnrolledSubjectMarkSummary = {
  theoryContinuous: number;
  theoryFinal: number;
  practicalContinuous: number;
  practicalFinal: number;
  releasedTheoryContinuous: number;
  releasedTheoryFinal: number;
  releasedPracticalContinuous: number;
  releasedPracticalFinal: number;
  total: number;
  releasedTotal: number;
  totalMarks: number;
  percentage: number;
  releasedPercentage: number;
  releasedMarks: number;
};

export type TEnrolledSubject = {
  semesterRegistration: Types.ObjectId;
  academicSemester: Types.ObjectId;
  academicInstructor: Types.ObjectId;
  academicDepartment: Types.ObjectId;
  offeredSubject: Types.ObjectId;
  subject: Types.ObjectId;
  student: Types.ObjectId;
  instructor: Types.ObjectId;
  isEnrolled: boolean;
  markingSchemeSnapshot: TSubjectMarkingScheme;
  markEntries: TEnrolledSubjectMarkEntry[];
  markSummary: TEnrolledSubjectMarkSummary;
  auditLogs: TEnrolledSubjectAuditLog[];
  resultStatus: TEnrolledSubjectResultStatus;
  grade: TGrade;
  gradePoints: number;
  finalResultPublishedAt?: Date | null;
  isCompleted: boolean;
};
