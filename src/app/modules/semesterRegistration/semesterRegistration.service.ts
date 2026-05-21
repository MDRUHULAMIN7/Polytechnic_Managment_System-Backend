import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { RegistrationStatus } from './semesterRegistration.constant.js';
import type { TSemesterRegistration } from './semesterRegistration.interface.js';
import { SemesterRegistration } from './semesterRegistration.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { AcademicSemester } from '../academicSemester/academicSemesterModel.js';
import mongoose from 'mongoose';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { validateRegistrationTimelineAgainstSemester } from './semesterRegistration.utils.js';

/**
 * Creates a new semester registration in the database.
 * Focuses on business logic: duplicate active registration prevention and timeline validation.
 */
const createSemesterRegistrationIntoDB = async (
  payload: TSemesterRegistration,
) => {
  const { academicSemester, shift, group } = payload;

  // Step 1: Check if the academic semester exists
  const academicSemesterExists =
    await AcademicSemester.findById(academicSemester);

  if (!academicSemesterExists) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'This academic semester not found!',
    );
  }

  // Step 2: Validate registration timeline against semester window
  validateRegistrationTimelineAgainstSemester({
    academicSemester: {
      year: academicSemesterExists.year,
      startMonth: academicSemesterExists.startMonth,
      endMonth: academicSemesterExists.endMonth,
    },
    startDateValue: payload.startDate,
    endDateValue: payload.endDate,
  });

  // Step 3: Check if this specific academicSemester + shift + group combination already has an active registration
  const isDuplicateActiveRegistration = await SemesterRegistration.findOne({
    academicSemester,
    shift,
    group: group || null,
    status: { $in: [RegistrationStatus.UPCOMING, RegistrationStatus.ONGOING] },
  });

  if (isDuplicateActiveRegistration) {
    const groupLabel = group ? ` Group ${group}` : '';
    throw new AppError(
      StatusCodes.CONFLICT,
      `This semester is already registered for ${shift} shift${groupLabel} with status ${isDuplicateActiveRegistration.status}!`,
    );
  }

  // Step 4: Create the semester registration
  const result = await SemesterRegistration.create(payload);
  return result;
};

/**
 * Retrieves all semester registrations with filtering, searching, and pagination.
 */
const getAllSemesterRegistrationsFromDB = async (
  query: Record<string, unknown>,
) => {
  const searchTerm =
    typeof query.searchTerm === 'string' ? query.searchTerm.trim() : '';

  let baseQuery = SemesterRegistration.find();

  // Search logic for semester registrations
  if (searchTerm) {
    const semesterMatches = await AcademicSemester.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { year: { $regex: searchTerm, $options: 'i' } },
        { startMonth: { $regex: searchTerm, $options: 'i' } },
        { endMonth: { $regex: searchTerm, $options: 'i' } },
      ],
    }).select('_id');

    const semesterIds = semesterMatches.map((item) => item._id);

    const orConditions: Record<string, unknown>[] = [
      { status: { $regex: searchTerm, $options: 'i' } },
      { shift: { $regex: searchTerm, $options: 'i' } },
      { group: { $regex: searchTerm, $options: 'i' } },
    ];

    if (semesterIds.length > 0) {
      orConditions.push({ academicSemester: { $in: semesterIds } });
    }

    baseQuery = SemesterRegistration.find({ $or: orConditions });
  }

  const semesterRegistrationQuery = new QueryBuilder(
    baseQuery.populate('academicSemester'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await semesterRegistrationQuery.modelQuery;
  const meta = await semesterRegistrationQuery.countTotal();

  return {
    meta,
    result,
  };
};

/**
 * Retrieves a single semester registration by ID.
 */
const getSingleSemesterRegistrationsFromDB = async (id: string) => {
  const result =
    await SemesterRegistration.findById(id).populate('academicSemester');

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  return result;
};

/**
 * Updates an existing semester registration.
 * Handles status transition logic, duplicate prevention, and timeline validation.
 */
const updateSemesterRegistrationIntoDB = async (
  id: string,
  payload: Partial<TSemesterRegistration>,
) => {
  const existingRegistration = await SemesterRegistration.findById(id);

  if (!existingRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'This semester registration is not found!');
  }

  const currentStatus = existingRegistration.status;
  const requestedStatus = payload.status;

  // 1. Immutable 'ENDED' status check
  if (currentStatus === RegistrationStatus.ENDED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `This registration has already ended and cannot be updated.`,
    );
  }

  // 2. Status transition flow validation
  if (requestedStatus && requestedStatus !== currentStatus) {
    // Cannot skip from UPCOMING to ENDED
    if (
      currentStatus === RegistrationStatus.UPCOMING &&
      requestedStatus === RegistrationStatus.ENDED
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Cannot change status directly from UPCOMING to ENDED.`,
      );
    }

    // Cannot go backward from ONGOING to UPCOMING
    if (
      currentStatus === RegistrationStatus.ONGOING &&
      requestedStatus === RegistrationStatus.UPCOMING
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Cannot change status from ONGOING back to UPCOMING.`,
      );
    }
  }

  // 3. 'ONGOING' status constraints
  if (currentStatus === RegistrationStatus.ONGOING) {
    if (requestedStatus === RegistrationStatus.ENDED) {
      // Only status update is allowed when moving from ONGOING to ENDED
      const allowedKeys = ['status'];
      const hasForbiddenFields = Object.keys(payload).some(
        (key) => !allowedKeys.includes(key),
      );

      if (hasForbiddenFields) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          `Only status can be updated to ENDED when the current status is ONGOING.`,
        );
      }
    } else if (requestedStatus && requestedStatus !== currentStatus) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Invalid status transition from ONGOING.`,
      );
    } else {
        // If status is not changing, and it's already ongoing, we don't allow other field updates usually
        // based on original logic.
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Cannot update fields other than status when registration is ONGOING.`,
          );
    }
  }

  // 4. Duplicate prevention logic
  const nextAcademicSemester = payload.academicSemester ?? existingRegistration.academicSemester;
  const nextShift = payload.shift ?? existingRegistration.shift;
  const nextGroup = payload.group !== undefined ? payload.group : existingRegistration.group;
  const nextStatus = requestedStatus ?? currentStatus;

  // If changing to an active status, ensure no other active registration exists for this semester/shift/group
  if (nextStatus === RegistrationStatus.UPCOMING || nextStatus === RegistrationStatus.ONGOING) {
    const duplicateActive = await SemesterRegistration.findOne({
      academicSemester: nextAcademicSemester,
      shift: nextShift,
      group: nextGroup || null,
      status: { $in: [RegistrationStatus.UPCOMING, RegistrationStatus.ONGOING] },
      _id: { $ne: id },
    });

    if (duplicateActive) {
      const groupLabel = nextGroup ? ` Group ${nextGroup}` : '';
      throw new AppError(
        StatusCodes.CONFLICT,
        `An active registration (${duplicateActive.status}) already exists for this semester, shift${groupLabel}!`,
      );
    }
  }

  // General uniqueness check for resulting combination
  const duplicateExact = await SemesterRegistration.findOne({
    academicSemester: nextAcademicSemester,
    shift: nextShift,
    group: nextGroup || null,
    status: nextStatus,
    _id: { $ne: id },
  });

  if (duplicateExact) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `A semester registration with this combination already exists!`,
    );
  }

  // 5. Timeline validation
  const semesterDoc = await AcademicSemester.findById(nextAcademicSemester);
  if (!semesterDoc) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic semester not found!');
  }

  validateRegistrationTimelineAgainstSemester({
    academicSemester: {
      year: semesterDoc.year,
      startMonth: semesterDoc.startMonth,
      endMonth: semesterDoc.endMonth,
    },
    startDateValue: payload.startDate ?? existingRegistration.startDate,
    endDateValue: payload.endDate ?? existingRegistration.endDate,
  });

  // 6. Execute update
  const result = await SemesterRegistration.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

/**
 * Deletes a semester registration and all associated offered subjects.
 * Only allowed for 'UPCOMING' registrations.
 */
const deleteSemesterRegistrationFromDB = async (id: string) => {
  const existingRegistration = await SemesterRegistration.findById(id);

  if (!existingRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  if (existingRegistration.status !== RegistrationStatus.UPCOMING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Cannot delete a registration that is ${existingRegistration.status}. Only UPCOMING registrations can be deleted.`,
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Delete associated offered subjects first
    await OfferedSubject.deleteMany(
      { semesterRegistration: id },
      { session },
    );

    // Delete the registration itself
    const deletedRegistration = await SemesterRegistration.findByIdAndDelete(id, {
      session,
    });

    if (!deletedRegistration) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Failed to delete semester registration.',
      );
    }

    await session.commitTransaction();
    return null;
  } catch (err: any) {
    await session.abortTransaction();
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, err.message || 'Failed to delete semester registration.');
  } finally {
    await session.endSession();
  }
};

export const SemesterRegistrationService = {
  createSemesterRegistrationIntoDB,
  getAllSemesterRegistrationsFromDB,
  getSingleSemesterRegistrationsFromDB,
  updateSemesterRegistrationIntoDB,
  deleteSemesterRegistrationFromDB,
};
