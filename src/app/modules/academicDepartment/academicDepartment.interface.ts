import { Types } from 'mongoose';

export type TAcademicDepartment = {
  name: string;
  academicInstructor: Types.ObjectId;
};