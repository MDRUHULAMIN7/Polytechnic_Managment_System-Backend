import { Types } from 'mongoose';

export type TPreRequisiteSubject = {
  subject: Types.ObjectId; 
  isDeleted: boolean;
};

export type TSubject = {
  title: string;         
  prefix: string;       
  code: number;       
  credits: number; 
  regulation: number;   
  preRequisiteSubjects: [TPreRequisiteSubject];
  isDeleted?: boolean;
};

export type TSubjectInstructor = {
  subject: Types.ObjectId;
  instructors: [Types.ObjectId];
};