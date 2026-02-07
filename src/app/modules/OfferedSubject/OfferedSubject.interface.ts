import { Types } from 'mongoose';

export type TDays = 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

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
};

export type TSchedule = {
  days: TDays[];
  startTime: string;
  endTime: string;
};