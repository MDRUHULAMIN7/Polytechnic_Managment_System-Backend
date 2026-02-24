import { Types } from 'mongoose';

export type TEnrollmentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export interface TSemesterEnrollment {
  student: Types.ObjectId;
  curriculum: Types.ObjectId;
  semesterRegistration: Types.ObjectId;
  academicSemester: Types.ObjectId;
  academicDepartment: Types.ObjectId;
  status: TEnrollmentStatus;
  fees: number;
  isPaid: boolean;
}

export type TCreateSemesterEnrollmentPayload = {
  curriculum: Types.ObjectId;
};
