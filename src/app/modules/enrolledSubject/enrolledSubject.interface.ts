import { Types } from 'mongoose';

export type TGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'NA';

export type TEnrolledSubjectMarks = {
  classTest1: number;
  midTerm: number;
  classTest2: number;
  finalTerm: number;
};

export type TEnrolledSubject = {
  semesterRegistration: Types.ObjectId;
  academicSemester: Types.ObjectId;
  academicInstructor: Types.ObjectId;
  academicDepartment: Types.ObjectId;
  offeredSubject : Types.ObjectId;
  subject: Types.ObjectId;
  student: Types.ObjectId;
  instructor: Types.ObjectId;
  isEnrolled: boolean;
  subjectMarks: TEnrolledSubjectMarks;
  grade: TGrade;
  gradePoints: number;
  isCompleted: boolean;
};
