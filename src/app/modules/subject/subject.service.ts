
import mongoose from 'mongoose';
import type { TSubject, TSubjectInstructor } from './subject.interface.js';
import { Subject, SubjectInstructor } from './subject.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { SubjectSearchableFields } from './subjecr.constant.js';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';

// Create Subject
const createSubjectIntoDB = async (payload: TSubject) => {
  const result = await Subject.create(payload);
  return result;  
};

// Get All Subjects
const getAllSubjectsFromDB = async (query: Record<string, unknown>) => {
  const subjectQuery = new QueryBuilder(Subject.find(), query)
    .search(SubjectSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await subjectQuery.modelQuery;
  return result;
};

// Get Single Subject
const getSingleSubjectFromDB = async (id: string) => {
  const result = await Subject.findById(id).populate('preRequisiteSubjects.subject');
  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found!');
  }
  return result;
};

// Update Subject
const updateSubjectIntoDB = async (id: string, payload: Partial<TSubject>) => {
  const { preRequisiteSubjects, ...subjectRemainingData } = payload;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Step 1: Update main subject fields
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      subjectRemainingData,
      { new: true, runValidators: true, session }
    );
   
    if (!updatedSubject) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to update subject!');
    }

    // Step 2: Update pre-requisite subjects if provided
    if (preRequisiteSubjects && preRequisiteSubjects.length > 0) {
      const deletedPreReqs = preRequisiteSubjects
        .filter((el) => el.subject && el.isDeleted)
        .map((el) => el.subject);

      if (deletedPreReqs.length > 0) {
        await Subject.findByIdAndUpdate(
          id,
          { $pull: { preRequisiteSubjects: { subject: { $in: deletedPreReqs } } } },
          { session }
        );
      }

      const newPreReqs = preRequisiteSubjects.filter((el) => el.subject && !el.isDeleted);

      if (newPreReqs.length > 0) {
        await Subject.findByIdAndUpdate(
          id,
          { $addToSet: { preRequisiteSubjects: { $each: newPreReqs } } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    await session.endSession();

    const result = await Subject.findById(id).populate('preRequisiteSubjects.subject');
    return result;
  } catch (err:any) {
    await session.abortTransaction();
    await session.endSession();
    throw new AppError(StatusCodes.BAD_REQUEST,  err.message ||'Failed to update subject!');
  }
};

// Delete Subject (Soft Delete)
const deleteSubjectFromDB = async (id: string) => {
  const result = await Subject.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  return result;
};

// Assign Instructors to Subject
const assignInstructorsWithSubjectIntoDB = async (
  id: string,
  payload: Partial<TSubjectInstructor>
) => {
  const result = await SubjectInstructor.findByIdAndUpdate(
    id,
    {
      subject: id,
      $addToSet: { instructors: { $each: payload.instructors || [] } },
    },
    { upsert: true, new: true }
  );
  return result;
};

// Remove Instructors from Subject
const removeInstructorsFromSubjectFromDB = async (
  id: string,
  payload: Partial<TSubjectInstructor>
) => {
  const result = await SubjectInstructor.findByIdAndUpdate(
    id,
    { $pull: { instructors: { $in: payload.instructors || [] } } },
    { new: true }
  );
  return result;
};

export const SubjectServices = {
  createSubjectIntoDB,
  getAllSubjectsFromDB,
  getSingleSubjectFromDB,
  updateSubjectIntoDB,
  deleteSubjectFromDB,
  assignInstructorsWithSubjectIntoDB,
  removeInstructorsFromSubjectFromDB,
};
