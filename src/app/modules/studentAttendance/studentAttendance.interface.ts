import { Types } from 'mongoose';

export const StudentAttendanceStatus = ['PRESENT', 'ABSENT', 'LEAVE'] as const;

export type TStudentAttendanceStatus =
  (typeof StudentAttendanceStatus)[number];

export type TStudentAttendance = {
  classSession: Types.ObjectId;
  offeredSubject: Types.ObjectId;
  enrolledSubject: Types.ObjectId;
  student: Types.ObjectId;
  status: TStudentAttendanceStatus;
  markedAt?: Date;
  remarks?: string;
};
