import { Types } from 'mongoose';

export interface TCurriculum {
  academicDepartment: Types.ObjectId;
  academicSemester: Types.ObjectId;
  semisterRegistration: Types.ObjectId;
  regulation: number;
  session: string;
  subjects: Types.ObjectId[];
  totalCredit: number;
}

export type TCreateCurriculumPayload = {
  academicDepartment: Types.ObjectId;
  semisterRegistration: Types.ObjectId;
  regulation: number;
  session: string;
  subjects: Types.ObjectId[];
};
