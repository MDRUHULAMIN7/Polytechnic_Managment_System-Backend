import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import type { TOfferedSubject, TScheduleBlockInput } from './OfferedSubject.interface.js';
import { AcademicInstructor } from '../academicInstructor/academicInstructor.model.js';
import { AcademicDepartment } from '../academicDepartment/academicDepartment.model.js';
import { Subject } from '../subject/subject.model.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import { OfferedSubject } from './OfferedSubject.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { Student } from '../student/student.model.js';
import type { TUserRole } from '../user/user.interface.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  cloneAssessmentComponents,
  cloneMarkingScheme,
} from '../subject/subject.marking.js';
import {
  collectScheduleConflicts,
  resolveSchedulePayload,
} from './OfferedSubject.utils.js';

const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  return instructor._id;
};

const pickFirstConflictMessage = (
  conflicts: ReturnType<typeof collectScheduleConflicts>,
) => {
  const priorityOrder = [
    'ROOM_CONFLICT',
    'INSTRUCTOR_CONFLICT',
    'DEPARTMENT_CONFLICT',
  ] as const;

  for (const type of priorityOrder) {
    const match = conflicts.find((conflict) => conflict.type === type);
    if (match) {
      return match.message;
    }
  }

  return conflicts[0]?.message ?? 'Schedule conflict detected.';
};

const ensureCommonReferencesExist = async (payload: {
  semesterRegistration: TOfferedSubject['semesterRegistration'];
  academicInstructor: TOfferedSubject['academicInstructor'];
  academicDepartment: TOfferedSubject['academicDepartment'];
  subject?: TOfferedSubject['subject'];
  instructor: TOfferedSubject['instructor'];
}) => {
  const isSemesterRegistrationExits = await SemesterRegistration.findById(
    payload.semesterRegistration,
  );

  if (!isSemesterRegistrationExits) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found !',
    );
  }

  const isAcademicInstructorExits = await AcademicInstructor.findById(
    payload.academicInstructor,
  );

  if (!isAcademicInstructorExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic Instructor not found !');
  }

  const isAcademicDepartmentExits = await AcademicDepartment.findById(
    payload.academicDepartment,
  );

  if (!isAcademicDepartmentExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic Department not found !');
  }

  const isInstructorExits = await Instructor.findById(payload.instructor);

  if (!isInstructorExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  if (payload.subject) {
    const isSubjectExits = await Subject.findById(payload.subject);

    if (!isSubjectExits) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found !');
    }
  }

  const isDepartmentBelongToInstructor = await AcademicDepartment.findOne({
    _id: payload.academicDepartment,
    academicInstructor: payload.academicInstructor,
  });

  if (!isDepartmentBelongToInstructor) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `This ${isAcademicDepartmentExits.name} is not belong to this ${isAcademicInstructorExits.name}.`,
    );
  }

  return {
    semesterRegistration: isSemesterRegistrationExits,
    academicDepartment: isAcademicDepartmentExits,
  };
};

const fetchComparableOfferedSubjects = async (
  semesterRegistrationId: string,
  excludeOfferedSubjectId?: string,
) => {
  return OfferedSubject.find({
    semesterRegistration: semesterRegistrationId,
    ...(excludeOfferedSubjectId ? { _id: { $ne: excludeOfferedSubjectId } } : {}),
  }).select('instructor academicDepartment scheduleBlocks days startTime endTime');
};

const getRequestedFields = (queryObj: Record<string, unknown>) => {
  if (typeof queryObj.fields !== 'string' || !queryObj.fields.trim()) {
    return null;
  }

  return new Set(
    queryObj.fields
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
  );
};

const shouldPopulateField = (
  requestedFields: Set<string> | null,
  field: string,
) => !requestedFields || requestedFields.has(field);

const buildOfferedSubjectQuery = (
  queryObj: Record<string, unknown>,
) => {
  const requestedFields = getRequestedFields(queryObj);
  let query = OfferedSubject.find();

  if (shouldPopulateField(requestedFields, 'semesterRegistration')) {
    query = query.populate({
      path: 'semesterRegistration',
      select: 'status shift startDate endDate academicSemester',
      populate: { path: 'academicSemester', select: 'name year' },
    });
  }

  if (shouldPopulateField(requestedFields, 'academicSemester')) {
    query = query.populate('academicSemester', 'name year');
  }

  if (shouldPopulateField(requestedFields, 'academicDepartment')) {
    query = query.populate('academicDepartment', 'name');
  }

  if (shouldPopulateField(requestedFields, 'subject')) {
    query = query.populate('subject', 'title code credits subjectType markingScheme');
  }

  if (shouldPopulateField(requestedFields, 'instructor')) {
    query = query.populate('instructor', 'id name designation');
  }

  if (shouldPopulateField(requestedFields, 'scheduleBlocks')) {
    query = query.populate(
      'scheduleBlocks.room',
      'roomName roomNumber buildingNumber capacity',
    );
  }

  return query;
};

const createOfferedSubjectIntoDB = async (payload: TOfferedSubject) => {
  const {
    semesterRegistration,
    academicInstructor,
    academicDepartment,
    subject,
    instructor,
    maxCapacity,
    scheduleBlocks,
  } = payload;

  const references = await ensureCommonReferencesExist({
    semesterRegistration,
    academicInstructor,
    academicDepartment,
    subject,
    instructor,
  });

  if (references.semesterRegistration.status === 'ENDED') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'The semester registration was already ended.',
    );
  }

  const academicSemester = references.semesterRegistration.academicSemester;

  const isSubjectExits = await Subject.findById(subject);

  if (!isSubjectExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found !');
  }

  const isSubjectAlreadyOfferedInRegistration = await OfferedSubject.findOne({
    semesterRegistration,
    subject,
  }).select('_id');

  if (isSubjectAlreadyOfferedInRegistration) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This subject is already offered in this semester registration!',
    );
  }

  const resolvedSchedule = await resolveSchedulePayload(
    scheduleBlocks as unknown as TScheduleBlockInput[],
    maxCapacity,
  );

  const existingSubjects = await fetchComparableOfferedSubjects(
    semesterRegistration.toString(),
  );
  const conflicts = collectScheduleConflicts(
    resolvedSchedule.scheduleBlocks,
    existingSubjects,
    {
      instructorId: instructor.toString(),
      academicDepartmentId: academicDepartment.toString(),
    },
  );

  if (conflicts.length) {
    throw new AppError(StatusCodes.CONFLICT, pickFirstConflictMessage(conflicts));
  }

  const result = await OfferedSubject.create({
    ...payload,
    academicSemester,
    days: resolvedSchedule.days,
    startTime: resolvedSchedule.startTime,
    endTime: resolvedSchedule.endTime,
    scheduleBlocks: resolvedSchedule.scheduleBlocks,
    markingSchemeSnapshot: cloneMarkingScheme(isSubjectExits.markingScheme),
    assessmentComponentsSnapshot: cloneAssessmentComponents(
      isSubjectExits.assessmentComponents,
    ),
    releasedComponentCodes: [],
    markingStatus: 'NOT_STARTED',
  });

  const populatedResult = await OfferedSubject.findById(result._id)
    .populate('subject', 'title code')
    .populate({
      path: 'semesterRegistration',
      select: 'shift academicSemester',
      populate: {
        path: 'academicSemester',
        select: 'name year',
      },
    })
    .populate('instructor', 'id');

  const instructorUserId =
    populatedResult &&
    populatedResult.instructor &&
    typeof populatedResult.instructor === 'object' &&
    'id' in populatedResult.instructor
      ? String(populatedResult.instructor.id)
      : null;

  if (populatedResult && instructorUserId) {
    void NotificationService.notifyOfferedSubjectAssigned({
      instructorUserId,
      offeredSubjectId: populatedResult._id.toString(),
      subject: populatedResult.subject,
      semesterRegistration: populatedResult.semesterRegistration,
    });
  }

  return result;
};

const getAllOfferedSubjectsFromDB = async (
  query: Record<string, unknown>,
  userId?: string,
  role?: TUserRole,
) => {
  const queryObj: Record<string, unknown> = { ...query };

  if (queryObj.scope === 'my' && role === 'instructor' && userId) {
    const instructorId = await resolveInstructorIdFromUserId(userId);
    queryObj.instructor = instructorId.toString();
  }

  if (typeof queryObj.room === 'string' && queryObj.room.trim()) {
    queryObj['scheduleBlocks.room'] = queryObj.room.trim();
  }
  delete queryObj.room;

  if (typeof queryObj.searchTerm === 'string' && queryObj.searchTerm.trim()) {
    const subjects = await Subject.find({
      title: {
        $regex: queryObj.searchTerm.trim(),
        $options: 'i',
      },
    }).select('_id');

    queryObj.subject = {
      $in: subjects.map((item) => item._id),
    };
    delete queryObj.searchTerm;
  }

  const offeredSubjectQuery = new QueryBuilder(
    buildOfferedSubjectQuery(queryObj),
    queryObj,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await offeredSubjectQuery.modelQuery;
  const meta = await offeredSubjectQuery.countTotal();
  return {
    meta,
    result,
  };
};

const getMyOfferedSubjectFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 10;
  const skip = (page - 1) * limit;

  const student = await Student.findOne({ id: userId });
  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User is not found');
  }

  const currentOngoingRegistrationSemesters = await SemesterRegistration.find({
    status: 'ONGOING',
  }).select('_id academicSemester');

  if (!currentOngoingRegistrationSemesters.length) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'There is no ongoing semester registration!',
    );
  }
  const currentOngoingRegistrationSemesterIds =
    currentOngoingRegistrationSemesters.map((registration) => registration._id);
  const currentOngoingAcademicSemesterIds =
    currentOngoingRegistrationSemesters.map(
      (registration) => registration.academicSemester,
    );

  const aggregationQuery = [
    {
      $match: {
        academicSemester: { $in: currentOngoingAcademicSemesterIds },
        academicInstructor: student.academicInstructor,
        academicDepartment: student.academicDepartment,
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'subject',
      },
    },
    {
      $unwind: '$subject',
    },
    {
      $lookup: {
        from: 'enrolledsubjects',
        let: {
          currentOngoingRegistrationSemesterIds,
          currentStudent: student._id,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: [
                      '$semesterRegistration',
                      '$$currentOngoingRegistrationSemesterIds',
                    ],
                  },
                  {
                    $eq: ['$student', '$$currentStudent'],
                  },
                  {
                    $eq: ['$isEnrolled', true],
                  },
                ],
              },
            },
          },
        ],
        as: 'enrolledSubject',
      },
    },
    {
      $lookup: {
        from: 'enrolledsubjects',
        let: {
          currentStudent: student._id,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$student', '$$currentStudent'],
                  },
                  {
                    $eq: ['$isCompleted', true],
                  },
                ],
              },
            },
          },
        ],
        as: 'completedSubject',
      },
    },
    {
      $addFields: {
        completedSubjectIds: {
          $map: {
            input: '$completedSubject',
            as: 'completed',
            in: '$$completed.subject',
          },
        },
      },
    },
    {
      $addFields: {
        preRequisiteSubjectIds: {
          $map: {
            input: { $ifNull: ['$subject.preRequisiteSubjects', []] },
            as: 'preRequisiteSubject',
            in: '$$preRequisiteSubject.subject',
          },
        },
        isAlreadyEnrolled: {
          $in: [
            '$subject._id',
            {
              $map: {
                input: { $ifNull: ['$enrolledSubject', []] },
                as: 'enroll',
                in: '$$enroll.subject',
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        isPreRequisitesFulFilled: {
          $or: [
            { $eq: [{ $size: { $ifNull: ['$preRequisiteSubjectIds', []] } }, 0] },
            {
              $setIsSubset: [
                { $ifNull: ['$preRequisiteSubjectIds', []] },
                { $ifNull: ['$completedSubjectIds', []] },
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        isAlreadyEnrolled: false,
        isPreRequisitesFulFilled: true,
      },
    },
    {
      $lookup: {
        from: 'semesterregistrations',
        localField: 'semesterRegistration',
        foreignField: '_id',
        as: 'semesterRegistration',
      },
    },
    {
      $unwind: {
        path: '$semesterRegistration',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'academicsemesters',
        localField: 'academicSemester',
        foreignField: '_id',
        as: 'academicSemester',
      },
    },
    {
      $unwind: {
        path: '$academicSemester',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  const paginationQuery = [
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ];

  const result = await OfferedSubject.aggregate([
    ...aggregationQuery,
    ...paginationQuery,
  ]);
  const total = (await OfferedSubject.aggregate(aggregationQuery)).length;

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    result,
  };
};

const getSingleOfferedSubjectFromDB = async (id: string) => {
  const offeredSubject = await OfferedSubject.findById(id);

  if (!offeredSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found');
  }

  if (!offeredSubject.semesterRegistration && offeredSubject.academicSemester) {
    const registrations = await SemesterRegistration.find({
      academicSemester: offeredSubject.academicSemester,
      status: { $in: ['ONGOING', 'UPCOMING'] },
    }).sort({ createdAt: -1 });

    const preferred =
      registrations.find((item) => item.status === 'ONGOING') ?? registrations[0];

    if (preferred) {
      offeredSubject.semesterRegistration = preferred._id;
      await offeredSubject.save();
    }
  }

  const populated = await OfferedSubject.findById(id)
    .populate('semesterRegistration')
    .populate('academicSemester')
    .populate('academicInstructor')
    .populate('academicDepartment')
    .populate('subject')
    .populate('instructor')
    .populate('scheduleBlocks.room', 'roomName roomNumber buildingNumber capacity');

  return populated;
};

const previewOfferedSubjectConflictsIntoDB = async (payload: {
  semesterRegistration: string;
  academicDepartment: string;
  instructor: string;
  maxCapacity: number;
  scheduleBlocks: TScheduleBlockInput[];
  excludeOfferedSubjectId?: string;
}) => {
  const semesterRegistration = await SemesterRegistration.findById(
    payload.semesterRegistration,
  ).select('_id');

  if (!semesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found.');
  }

  const academicDepartment = await AcademicDepartment.findById(
    payload.academicDepartment,
  ).select('_id');

  if (!academicDepartment) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found.');
  }

  const instructor = await Instructor.findById(payload.instructor).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found.');
  }

  const resolvedSchedule = await resolveSchedulePayload(
    payload.scheduleBlocks,
    payload.maxCapacity,
  );
  const existingSubjects = await fetchComparableOfferedSubjects(
    payload.semesterRegistration,
    payload.excludeOfferedSubjectId,
  );
  const conflicts = collectScheduleConflicts(
    resolvedSchedule.scheduleBlocks,
    existingSubjects,
    {
      instructorId: payload.instructor,
      academicDepartmentId: payload.academicDepartment,
    },
  );

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    scheduleBlocks: resolvedSchedule.scheduleBlocks,
    days: resolvedSchedule.days,
    startTime: resolvedSchedule.startTime,
    endTime: resolvedSchedule.endTime,
  };
};

const updateOfferedSubjectIntoDB = async (
  id: string,
  payload: Pick<TOfferedSubject, 'instructor' | 'maxCapacity' | 'scheduleBlocks'>,
) => {
  const { instructor, maxCapacity, scheduleBlocks } = payload;

  const isOfferedSubjectExists = await OfferedSubject.findById(id);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found !');
  }

  const previousOfferedSubject = await OfferedSubject.findById(id)
    .populate('subject', 'title code')
    .populate({
      path: 'semesterRegistration',
      select: 'shift academicSemester',
      populate: {
        path: 'academicSemester',
        select: 'name year',
      },
    })
    .populate('instructor', 'id');

  const isInstructorExists = await Instructor.findById(instructor);

  if (!isInstructorExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  const semesterRegistration = isOfferedSubjectExists.semesterRegistration;
  const semesterRegistrationStatus =
    await SemesterRegistration.findById(semesterRegistration);

  if (semesterRegistrationStatus?.status !== 'UPCOMING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `You can not update this offered subject as it is ${semesterRegistrationStatus?.status}.`,
    );
  }

  const resolvedSchedule = await resolveSchedulePayload(
    scheduleBlocks as unknown as TScheduleBlockInput[],
    maxCapacity,
  );
  const existingSubjects = await fetchComparableOfferedSubjects(
    semesterRegistration.toString(),
    id,
  );
  const conflicts = collectScheduleConflicts(
    resolvedSchedule.scheduleBlocks,
    existingSubjects,
    {
      instructorId: instructor.toString(),
      academicDepartmentId: isOfferedSubjectExists.academicDepartment.toString(),
    },
  );

  if (conflicts.length) {
    throw new AppError(StatusCodes.CONFLICT, pickFirstConflictMessage(conflicts));
  }

  const result = await OfferedSubject.findByIdAndUpdate(
    id,
    {
      instructor,
      maxCapacity,
      days: resolvedSchedule.days,
      startTime: resolvedSchedule.startTime,
      endTime: resolvedSchedule.endTime,
      scheduleBlocks: resolvedSchedule.scheduleBlocks,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (previousOfferedSubject && result) {
    const previousInstructorId =
      previousOfferedSubject.instructor &&
      typeof previousOfferedSubject.instructor === 'object' &&
      'id' in previousOfferedSubject.instructor
        ? String(previousOfferedSubject.instructor.id)
        : null;

    const nextInstructor = await OfferedSubject.findById(result._id)
      .populate('subject', 'title code')
      .populate({
        path: 'semesterRegistration',
        select: 'shift academicSemester',
        populate: {
          path: 'academicSemester',
          select: 'name year',
        },
      })
      .populate('instructor', 'id');

    const nextInstructorId =
      nextInstructor &&
      nextInstructor.instructor &&
      typeof nextInstructor.instructor === 'object' &&
      'id' in nextInstructor.instructor
        ? String(nextInstructor.instructor.id)
        : null;

    if (
      previousInstructorId &&
      nextInstructor &&
      nextInstructorId &&
      previousInstructorId !== nextInstructorId
    ) {
      void NotificationService.notifyOfferedSubjectRemoved({
        instructorUserId: previousInstructorId,
        offeredSubjectId: previousOfferedSubject._id.toString(),
        subject: previousOfferedSubject.subject,
        semesterRegistration: previousOfferedSubject.semesterRegistration,
      });

      void NotificationService.notifyOfferedSubjectAssigned({
        instructorUserId: nextInstructorId,
        offeredSubjectId: nextInstructor._id.toString(),
        subject: nextInstructor.subject,
        semesterRegistration: nextInstructor.semesterRegistration,
      });
    }
  }

  return result;
};

const deleteOfferedSubjectFromDB = async (id: string) => {
  const isOfferedSubjectExists = await OfferedSubject.findById(id);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found');
  }

  const semesterRegistation = isOfferedSubjectExists.semesterRegistration;

  const semesterRegistrationStatus =
    await SemesterRegistration.findById(semesterRegistation).select('status');

  if (semesterRegistrationStatus?.status !== 'UPCOMING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Offered Subject can not update ! because the semester ${semesterRegistrationStatus}`,
    );
  }

  const previousOfferedSubject = await OfferedSubject.findById(id)
    .populate('subject', 'title code')
    .populate({
      path: 'semesterRegistration',
      select: 'shift academicSemester',
      populate: {
        path: 'academicSemester',
        select: 'name year',
      },
    })
    .populate('instructor', 'id');

  const result = await OfferedSubject.findByIdAndDelete(id);

  const instructorUserId =
    previousOfferedSubject &&
    previousOfferedSubject.instructor &&
    typeof previousOfferedSubject.instructor === 'object' &&
    'id' in previousOfferedSubject.instructor
      ? String(previousOfferedSubject.instructor.id)
      : null;

  if (previousOfferedSubject && instructorUserId) {
    void NotificationService.notifyOfferedSubjectRemoved({
      instructorUserId,
      offeredSubjectId: previousOfferedSubject._id.toString(),
      subject: previousOfferedSubject.subject,
      semesterRegistration: previousOfferedSubject.semesterRegistration,
    });
  }

  return result;
};

export const OfferedSubjectServices = {
  createOfferedSubjectIntoDB,
  getAllOfferedSubjectsFromDB,
  getMyOfferedSubjectFromDB,
  getSingleOfferedSubjectFromDB,
  previewOfferedSubjectConflictsIntoDB,
  deleteOfferedSubjectFromDB,
  updateOfferedSubjectIntoDB,
};
