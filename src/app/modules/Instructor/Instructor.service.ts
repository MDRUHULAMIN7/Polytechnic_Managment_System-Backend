import mongoose from "mongoose";
import QueryBuilder from "../../../builder/QueryBuilder.js";
import { InstructorSearchableFields } from "./Instructor.constant.js";
import type { TInstructor } from "./Instructor.interface.js";
import { Instructor } from "./Instructor.model.js";
import AppError from "../../errors/AppError.js";
import { StatusCodes } from "http-status-codes";
import { User } from "../user/user.model.js";
import { SubjectInstructor } from "../subject/subject.model.js";


const getAllInstructorsFromDB = async (query: Record<string, unknown>) => {
  const instructorQuery = new QueryBuilder(
    Instructor.find()
      .populate('academicDepartment')
      .populate('user', '_id id role email status'),
    query,
  )
    .search(InstructorSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await instructorQuery.modelQuery;
  const meta = await instructorQuery.countTotal();
  return {
    meta,
    result,
  };
};

const getSingleInstructorFromDB = async (id: string) => {
  const result = await Instructor.findById(id)
    .populate('academicDepartment')
    .populate('user');

  return result;
};

const getInstructorSummaryFromDB = async (id: string) => {
  const result = await Instructor.findById(id)
    .select('id name designation email profileImg academicDepartment user')
    .populate('academicDepartment')
    .populate('user', '_id id role email status');

  return result;
};

const getAssignedSubjectsForInstructorFromDB = async (instructorId: string) => {
  const assignments = await SubjectInstructor.find({
    instructors: instructorId,
  }).populate('subject');

  const subjects = assignments
    .map((item) => item.subject)
    .filter(
      (subject): subject is NonNullable<typeof subject> =>
        Boolean(subject) && (subject as { isDeleted?: boolean }).isDeleted !== true,
    );

  return subjects;
};

const updateInstructorIntoDB = async (id: string, payload: Partial<TInstructor>) => {
  const { name, ...remainingInstructorData } = payload;

  const modifiedUpdatedData: Record<string, unknown> = {
    ...remainingInstructorData,
  };

  if (name && Object.keys(name).length) {
    for (const [key, value] of Object.entries(name)) {
      modifiedUpdatedData[`name.${key}`] = value;
    }
  }

  const result = await Instructor.findByIdAndUpdate(id, modifiedUpdatedData, {
    new: true,
    runValidators: true,
  });
  return result;
};

const deleteInstructorFromDB = async (id: string) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const deletedInstructor = await Instructor.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session },
    );

    if (!deletedInstructor) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to delete faculty');
    }

    // get user _id from deletedFaculty
    const userId = deletedInstructor.user;

    const deletedUser = await User.findByIdAndUpdate(
      userId,
      { isDeleted: true },
      { new: true, session },
    );

    if (!deletedUser) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to delete user');
    }

    await session.commitTransaction();
    await session.endSession();

    return deletedInstructor;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

export const InstructorServices = {
  getAllInstructorsFromDB,
  getSingleInstructorFromDB,
  getInstructorSummaryFromDB,
  getAssignedSubjectsForInstructorFromDB,
  updateInstructorIntoDB,
  deleteInstructorFromDB,
};
