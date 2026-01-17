import { academicSemesterNameCodeMapper } from './academicSemester.constant.js';
import type { TAcademicSemester } from './academicSemester.interface.js';
import { AcademicSemester } from './academicSemesterModel.js';

const createAcademicSemesterIntoDB = async (payloda: TAcademicSemester) => {
  //semester name --> semster code

  if (academicSemesterNameCodeMapper[payloda.name] !== payloda.code) {
    throw new Error('Invalid Semester Code');
  }

  const result = await AcademicSemester.create(payloda);
  return result;
};

const getAllAcademicSemesterFromDB = async()=>{
   const result =await AcademicSemester.find();
   return result;
}

const getSingleAcademicSemesterFromDB = async(_id:string)=>{
     const result =await AcademicSemester.findOne({_id});
     return result;
}

const updateAcademicSemesterIntoDB = async (
  id: string,
  payload: Partial<TAcademicSemester>,
) => {
  if (
    payload.name &&
    payload.code &&
    academicSemesterNameCodeMapper[payload.name] !== payload.code
  ) {
    throw new Error('Invalid Semester Code');
  }

  const result = await AcademicSemester.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });
  return result;
};

export const AcademicSemesterServices = {
  createAcademicSemesterIntoDB,
  getAllAcademicSemesterFromDB,
  getSingleAcademicSemesterFromDB,
  updateAcademicSemesterIntoDB ,
};
