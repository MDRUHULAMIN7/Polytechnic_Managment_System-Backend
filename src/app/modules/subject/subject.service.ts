
import mongoose from 'mongoose';
import type { TSubject, TSubjectInstructor } from './subject.interface.js';
import { Subject, SubjectInstructor } from './subject.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import type { TUserRole } from '../user/user.interface.js';

const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found!');
  }

  return instructor._id;
};

// Create Subject
const createSubjectIntoDB = async (payload: TSubject) => {
  const result = await Subject.create(payload);
  return result;  
};

// Get All Subjects
const getAllSubjectsFromDB = async (
  query: Record<string, unknown>,
  userId?: string,
  role?: TUserRole,
) => {
  const searchTerm = typeof query.searchTerm === 'string' ? query.searchTerm.trim() : '';
  const searchConditions: Record<string, unknown>[] = [];
  const notDeletedCondition = { isDeleted: { $ne: true } };
  const queryObj = { ...query };

  if (searchTerm) {
    searchConditions.push(
      { title: { $regex: searchTerm, $options: 'i' } },
      { prefix: { $regex: searchTerm, $options: 'i' } },
    );

    const numericSearchTerm = Number(searchTerm);
    if (!Number.isNaN(numericSearchTerm)) {
      searchConditions.push({ code: numericSearchTerm });
    }
  }

  const baseCriteria: Record<string, unknown> =
    searchConditions.length > 0
      ? { ...notDeletedCondition, $or: searchConditions }
      : { ...notDeletedCondition };

  if (queryObj.scope === 'my' && role === 'instructor' && userId) {
    const instructorId = await resolveInstructorIdFromUserId(userId);
    const assignedSubjectIds = await SubjectInstructor.find({
      instructors: instructorId,
    }).distinct('subject');

    baseCriteria._id = { $in: assignedSubjectIds };
  }

  const subjectQuery = new QueryBuilder(
    Subject.find(baseCriteria),
    queryObj,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await subjectQuery.modelQuery;
  const meta = await subjectQuery.countTotal();
  return {
    meta,
    result,
  };
};

// Get Single Subject
const getSingleSubjectFromDB = async (id: string) => {
  const result = await Subject.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
    'preRequisiteSubjects.subject',
  );
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
  const instructorIds = payload.instructors || [];

  if (instructorIds.length) {
    const invalidInstructorIds = instructorIds.filter(
      (instructorId) => !mongoose.isValidObjectId(instructorId)
    );

    if (invalidInstructorIds.length) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Invalid instructor id(s): ${invalidInstructorIds.join(', ')}`
      );
    }

    const existingInstructors = await Instructor.find({
      _id: { $in: instructorIds },
    }).select('_id');

    const existingInstructorIdSet = new Set(
      existingInstructors.map((instructor) => instructor._id.toString())
    );

    const missingInstructorIds = instructorIds.filter(
      (instructorId) =>
        !existingInstructorIdSet.has(instructorId.toString())
    );

    if (missingInstructorIds.length) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        `Instructors not found : ${missingInstructorIds.join(', ')}`
      );
    }

    const existingSubjectInstructor = await SubjectInstructor.findOne({
      subject: id,
    }).select('instructors');

    const assignedInstructorIdSet = new Set(
      (existingSubjectInstructor?.instructors || []).map((instructorId) =>
        instructorId.toString()
      )
    );

    const alreadyAssignedInstructorIds = instructorIds.filter((instructorId) =>
      assignedInstructorIdSet.has(instructorId.toString())
    );

    if (alreadyAssignedInstructorIds.length) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `Instructor already assigned for this subject: ${alreadyAssignedInstructorIds.join(', ')}`
      );
    }
  }

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
const getInstructorWithSubjectFromDB = async (subjectId: string) => {
  const result = await SubjectInstructor.findOne({ subject: subjectId }).populate(
    'instructors',
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
  getInstructorWithSubjectFromDB,
  removeInstructorsFromSubjectFromDB,
};
