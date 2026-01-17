import { model, Schema } from 'mongoose';
import type { TAcademicSemester } from './academicSemester.interface.js';
import { AcademicSemesterCodes,Months, AcademicSemesterNames } from './academicSemester.constant.js';



const academicSemesterSchema = new Schema<TAcademicSemester>(
  {
    name: {
      type: String,
      enum:AcademicSemesterNames ,
      required: true,
    },
    code: {
      type: String,
      enum:AcademicSemesterCodes,
      required: true,
    },
    year: {
      type: String,
      required: true,
    },
    startMonth: {
      type: String,
      enum: Months,
      required: true,
    },
    endMonth: {
      type: String,
      enum: Months,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

academicSemesterSchema.pre('save',async function () {

  const isSemesterExists = await AcademicSemester.findOne({
    year:this.year,
    name:this.name,
  })

  if(isSemesterExists){
    throw new Error('Semester is already exists in this year !')
  }
  
})

export const AcademicSemester = model<TAcademicSemester>(
  'AcademicSemester',
  academicSemesterSchema,
);
