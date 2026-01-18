import type { TAcademicInstructor } from "./academicInstructor.interface.js";
import { AcademicInstructor } from "./academicInstructor.model.js";


const createAcademicInstructorIntoDB = async (payload: TAcademicInstructor) => {
  const result = await AcademicInstructor.create(payload);
  return result;
};

const getAllAcademicFacultiesFromDB = async () => {
  const result = await AcademicInstructor.find();
  return result;
};

const getSingleAcademicInstructorFromDB = async (id: string) => {
  const result = await AcademicInstructor.findById(id);
  return result;
};

const updateAcademicInstructorIntoDB = async (
  id: string,
  payload: Partial<TAcademicInstructor>,
) => {
  const result = await AcademicInstructor.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });
  return result;
};

export const AcademicInstructorServices = {
  createAcademicInstructorIntoDB,
  getAllAcademicFacultiesFromDB,
  getSingleAcademicInstructorFromDB,
  updateAcademicInstructorIntoDB,
};