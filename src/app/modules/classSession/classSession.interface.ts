import { Types } from 'mongoose';
import type { TDays } from '../OfferedSubject/OfferedSubject.interface.js';

export const ClassSessionStatus = [
  'SCHEDULED',
  'ONGOING',
  'COMPLETED',
  'CANCELLED',
  'MISSED',
] as const;

export type TClassSessionStatus = (typeof ClassSessionStatus)[number];

export type TClassSession = {
  offeredSubject: Types.ObjectId;
  semesterRegistration: Types.ObjectId;
  academicSemester: Types.ObjectId;
  academicDepartment: Types.ObjectId;
  subject: Types.ObjectId;
  instructor: Types.ObjectId;
  sessionNumber: number;
  date: Date;
  day: TDays;
  startTime: string;
  endTime: string;
  topic?: string;
  remarks?: string;
  status: TClassSessionStatus;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  instructorCheckInTime?: Date;
  instructorCheckOutTime?: Date;
};

export type TSyncClassSessionResult = {
  offeredSubjectId: string;
  generatedCount: number;
  skippedCount: number;
  totalStudents: number;
};
export type TPopulatedStudent = {
  _id: { toString(): string };
  id: string;
  name: unknown;
  email: string;
  contactNo: string;
};

export type TFilterOption = {
  value: string;
  label: string;
};

export type TSemesterRegistrationOptionSource = {
  _id: { toString(): string };
  status?: string;
  shift?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  academicSemester?: { name?: string; year?: string } | string | null;
};