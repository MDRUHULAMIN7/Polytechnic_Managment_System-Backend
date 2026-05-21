import { Types } from 'mongoose';
import type { TDays } from '../OfferedSubject/OfferedSubject.interface.js';
import type { TOfferedSubjectClassType } from '../OfferedSubject/OfferedSubject.interface.js';

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
  room?: Types.ObjectId;
  classType?: TOfferedSubjectClassType;
  sessionNumber: number;
  date: Date;
  day: TDays;
  startPeriod?: number;
  periodCount?: number;
  periodNumbers?: number[];
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
  updatedCount: number;
  skippedCount: number;
  totalStudents: number;
  processedMonths: number;
};

export type TClassSessionRescheduleRoomOption = {
  _id: string;
  roomName: string;
  roomNumber: number;
  buildingNumber: number;
  capacity: number;
  roomType: 'theory' | 'practical' | 'both';
};

export type TClassSessionRescheduleSlotOption = {
  startPeriod: number;
  periodCount: number;
  periodNumbers: number[];
  startTime: string;
  endTime: string;
  isInstructorAvailable: boolean;
  instructorConflictMessage: string | null;
  availableRooms: TClassSessionRescheduleRoomOption[];
  isCurrentRoomAvailable: boolean;
  isValid: boolean;
  blockingReason: string | null;
  /** Curriculum-level conflict info */
  curriculumConflict: {
    hasConflict: boolean;
    conflictingSubjects: string[];
    message: string;
  } | null;
};

export type TClassSessionRescheduleAvailability = {
  classSessionId: string;
  date: string;
  day: TDays;
  shift: 'MORNING' | 'DAY';
  classType?: TOfferedSubjectClassType;
  requiredPeriodCount: number;
  totalStudents: number;
  currentRoomId: string | null;
  currentStartPeriod: number | null;
  currentPeriodNumbers: number[];
  periods: Array<{
    periodNo: number;
    title?: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }>;
  slots: TClassSessionRescheduleSlotOption[];
  /** Comprehensive validation information for the target date */
  validationInfo: {
    hasSameSubjectDuplicate: boolean;
    duplicateMessage: string | null;
    hasCurriculumConflict: boolean;
    curriculumConflictSubjects: string[];
    chronoSequenceCheck: {
      isValid: boolean;
      reason: string | null;
      nextClassDate: string | null;
    };
  };
};

export type TCurriculumClassScheduleStatus = {
  hasSessions: boolean;
  totalSessions: number;
  totalOfferedSubjects: number;
  canSchedule: boolean;
  registrationStatus: string | null;
  blockingReason: string | null;
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
