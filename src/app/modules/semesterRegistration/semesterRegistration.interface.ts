import { Types } from 'mongoose';

export type TSemesterRegistration = {
  academicSemester: Types.ObjectId;
  status: 'UPCOMING' | 'ONGOING' | 'ENDED';
  shift: 'MORNING' | 'DAY';
  startDate: Date;
  endDate: Date;
  totalCredit: number;
};