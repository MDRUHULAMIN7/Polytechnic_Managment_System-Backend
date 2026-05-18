import mongoose from 'mongoose';
import type { TSubject, TSubjectInstructor } from './subject.interface.js';
import { Subject, SubjectInstructor } from './subject.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import type { TUserRole } from '../user/user.interface.js';
import { normalizeMarkingPayload } from './subject.marking.js';
import { buildSubjectSearchQuery } from './subject.utils.js';

const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found!');
  }

  return instructor._id;
};

// Create Subject
const createSubjectIntoDB = async (payload: TSubject) => {
  const normalizedMarkingPayload = normalizeMarkingPayload({
    markingScheme: payload.markingScheme,
    assessmentComponents: payload.assessmentComponents,
  });

  const result = await Subject.create({
    ...payload,
    ...normalizedMarkingPayload,
  });
  return result;
};

// Get All Subjects
const getAllSubjectsFromDB = async (
  query: Record<string, unknown>,
  userId?: string,
  role?: TUserRole,
) => {
  const { baseCriteria, queryObj } = buildSubjectSearchQuery(query);

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
  const {
    preRequisiteSubjects,
    markingScheme,
    assessmentComponents,
    ...subjectRemainingData
  } = payload;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const existingSubject = await Subject.findById(id).session(session);
    if (!existingSubject) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found!');
    }

    // 1. Handle Marking Normalization if needed
    let normalizedMarkingPayload = {};
    if (markingScheme || assessmentComponents) {
      normalizedMarkingPayload = normalizeMarkingPayload({
        markingScheme: markingScheme ?? existingSubject.markingScheme,
        assessmentComponents:
          assessmentComponents ?? existingSubject.assessmentComponents,
      });
    }

    // 2. Update Basic Subject Data
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { ...subjectRemainingData, ...normalizedMarkingPayload },
      { new: true, runValidators: true, session },
    );

    if (!updatedSubject) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to update subject!');
    }

    // 3. Update Pre-requisites efficiently
    if (preRequisiteSubjects?.length) {
      const deletedPreReqs = preRequisiteSubjects
        .filter((el) => el.subject && el.isDeleted)
        .map((el) => el.subject);

      if (deletedPreReqs.length > 0) {
        await Subject.findByIdAndUpdate(
          id,
          { $pull: { preRequisiteSubjects: { subject: { $in: deletedPreReqs } } } },
          { session },
        );
      }

      const newPreReqs = preRequisiteSubjects.filter(
        (el) => el.subject && !el.isDeleted,
      );

      if (newPreReqs.length > 0) {
        await Subject.findByIdAndUpdate(
          id,
          { $addToSet: { preRequisiteSubjects: { $each: newPreReqs } } },
          { session },
        );
      }
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }

  return Subject.findById(id).populate('preRequisiteSubjects.subject');
};

// Delete Subject (Soft Delete)
const deleteSubjectFromDB = async (id: string) => {
  const result = await Subject.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  return result;
};

// Assign Instructors to Subject
const assignInstructorsWithSubjectIntoDB = async (
  id: string,
  payload: Partial<TSubjectInstructor>,
) => {
  const instructorIds = payload.instructors || [];

  if (instructorIds.length > 0) {
    // 1. Validate Subject existence
    const subjectExists = await Subject.exists({ _id: id });
    if (!subjectExists) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found!');
    }

    // 2. Validate Instructor IDs format
    const invalidIds = instructorIds.filter(id => !mongoose.isValidObjectId(id));
    if (invalidIds.length > 0) {
      throw new AppError(StatusCodes.BAD_REQUEST, `Invalid instructor ID(s): ${invalidIds.join(', ')}`);
    }

    // 3. Verify Instructors exist in DB
    const existingInstructorsCount = await Instructor.countDocuments({
      _id: { $in: instructorIds },
    });

    if (existingInstructorsCount !== instructorIds.length) {
      throw new AppError(StatusCodes.NOT_FOUND, 'One or more instructors not found!');
    }
  }

  const result = await SubjectInstructor.findByIdAndUpdate(
    id,
    {
      subject: id,
      $addToSet: { instructors: { $each: instructorIds } },
    },
    { upsert: true, new: true },
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
  payload: Partial<TSubjectInstructor>,
) => {
  const result = await SubjectInstructor.findByIdAndUpdate(
    id,
    { $pull: { instructors: { $in: payload.instructors || [] } } },
    { new: true },
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
