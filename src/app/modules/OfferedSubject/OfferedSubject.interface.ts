import { Types } from 'mongoose';
import type {
  TAssessmentComponent,
  TSubjectMarkingScheme,
} from '../subject/subject.interface.js';
import type { OfferedSubjectClassTypes } from './OfferedSubject.constant.js';

export type TDays = 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
export type TOfferedSubjectClassType =
  (typeof OfferedSubjectClassTypes)[number];

export type TScheduleBlockInput = {
  classType: TOfferedSubjectClassType;
  day: TDays;
  room: Types.ObjectId;
  startPeriod: number;
  periodCount: number;
};

export type TScheduleBlock = TScheduleBlockInput & {
  periodNumbers: number[];
  startTimeSnapshot: string;
  endTimeSnapshot: string;
};

export const OfferedSubjectMarkingStatuses = [
  'NOT_STARTED',
  'ONGOING',
  'PARTIALLY_RELEASED',
  'FINAL_PUBLISHED',
] as const;

export type TOfferedSubjectMarkingStatus =
  (typeof OfferedSubjectMarkingStatuses)[number];

export type TOfferedSubject = {
  semesterRegistration: Types.ObjectId;
  academicSemester: Types.ObjectId;
  academicInstructor: Types.ObjectId;
  academicDepartment: Types.ObjectId;
  subject: Types.ObjectId;
  instructor: Types.ObjectId;
  maxCapacity: number;
  section: number;
  days: TDays[];
  startTime: string;
  endTime: string;
  scheduleBlocks: TScheduleBlock[];
  markingSchemeSnapshot: TSubjectMarkingScheme;
  assessmentComponentsSnapshot: TAssessmentComponent[];
  releasedComponentCodes: string[];
  finalResultPublishedAt?: Date | null;
  markingStatus: TOfferedSubjectMarkingStatus;
};

export type TSchedule = {
  days: TDays[];
  startTime: string;
  endTime: string;
};
