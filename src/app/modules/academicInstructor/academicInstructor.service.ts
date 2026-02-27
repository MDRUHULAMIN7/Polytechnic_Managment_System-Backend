import QueryBuilder from "../../../builder/QueryBuilder.js";
import type { TAcademicInstructor } from "./academicInstructor.interface.js";
import { AcademicInstructor } from "./academicInstructor.model.js";


const createAcademicInstructorIntoDB = async (payload: TAcademicInstructor) => {
  const result = await AcademicInstructor.create(payload);
  return result;
};

const getAllAcademicFacultiesFromDB = async (query: Record<string, unknown>) => {
  const normalizedQuery: Record<string, unknown> = { ...query };
  const startsWith = normalizedQuery.startsWith;

  if (startsWith === "a-m") {
    normalizedQuery.name = { $regex: "^[A-M]", $options: "i" };
  } else if (startsWith === "n-z") {
    normalizedQuery.name = { $regex: "^[N-Z]", $options: "i" };
  }

  delete normalizedQuery.startsWith;

  const academicInstructorQuery = new QueryBuilder(
    AcademicInstructor.find(),
    normalizedQuery,
  )
    .search(["name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await academicInstructorQuery.modelQuery;
  const meta = await academicInstructorQuery.countTotal();
    return {
    meta,
    result,
  };
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
