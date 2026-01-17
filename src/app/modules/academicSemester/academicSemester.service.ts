import { academicSemesterNameCodeMapper } from './academicSemester.constant.js';
import type { TAcademicSemester } from './academicSemester.interface.js';
import { AcademicSemester } from './academicSemesterModel.js';

const createAcademicSemesterIntoDB = async (payloda: TAcademicSemester) => {

    //semester name --> semster code 

  

    if(academicSemesterNameCodeMapper[payloda.name] !== payloda.code){
        throw new Error("Invalid Semester Code")
    }

  const result = await AcademicSemester.create(payloda);
  return result;
};

export const AcademicSemesterServices = {
  createAcademicSemesterIntoDB,
};
