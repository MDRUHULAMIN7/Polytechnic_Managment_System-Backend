import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import type {
  TOfferedSubject,
  TOfferedSubjectSchedulePlan,
  TOfferedSubjectSchedulePlanInput,
  TOfferedSubjectSchedulePlanSuggestionBlock,
  TScheduleBlock,
  TScheduleBlockInput,
  TBulkOfferedSubjectSchedulePlanInput,
  TBulkOfferedSubjectSchedulePlan,
} from './OfferedSubject.interface.js';
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
  ensureAssessmentComponentsComplete,
} from '../subject/subject.marking.js';
import { PeriodConfigServices } from '../periodConfig/periodConfig.service.js';
import { Room } from '../room/room.model.js';
import {
  collectScheduleConflicts,
  doScheduleBlocksOverlap,
  fetchComparableOfferedSubjects,
  resolveSchedulePayload,
} from './OfferedSubject.utils.js';
import { DaySortOrder, timeToMinutes } from './OfferedSubject.constant.js';

const PLANNER_WORKING_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const;

type TPlannerPeriod = {
  periodNo: number;
  startTime: string;
  endTime: string;
};

type TPlannerRoom = {
  _id: Types.ObjectId;
  roomName: string;
  roomNumber: number;
  buildingNumber: number;
  capacity: number;
  roomType: 'theory' | 'practical' | 'both';
};

type TPlannerBlueprint = {
  classType: 'theory' | 'practical' | 'tutorial';
  periodCount: number;
  label: string;
  minimumPeriodCount?: number;
};

type TPlannerCandidateBlock = TScheduleBlock & {
  roomLabel: string;
  instructorId: string;
};

const buildRoomLabel = (room: TPlannerRoom) =>
  `${room.roomName} | Building ${room.buildingNumber} | Room ${room.roomNumber} | Cap ${room.capacity}`;

const buildSubjectMeetingBlueprint = (subject: {
  credits: number;
  subjectType: string;
  markingScheme?: {
    practicalContinuous?: number;
    practicalFinal?: number;
  };
}) => {
  const roundedCredits = Math.max(1, Math.round(subject.credits || 1));
  const practicalMarks =
    (subject.markingScheme?.practicalContinuous ?? 0) +
    (subject.markingScheme?.practicalFinal ?? 0);
  const includesPractical =
    practicalMarks > 0 ||
    [
      'THEORY_PRACTICAL',
      'PRACTICAL_ONLY',
      'PROJECT',
      'INDUSTRIAL_ATTACHMENT',
    ].includes(subject.subjectType);
  const reasoning: string[] = [
    `Used ${roundedCredits} weekly meeting target from the subject credit value.`,
  ];

  let blocks: TPlannerBlueprint[] = [];

  switch (subject.subjectType) {
    case 'THEORY':
      blocks = Array.from({ length: roundedCredits }, (_, index) => ({
        classType: 'theory' as const,
        periodCount: 1,
        label: `Theory class ${index + 1}`,
      }));
      reasoning.push(
        'Theory subjects were spread as one-period meetings across separate days.',
      );
      break;
    case 'THEORY_PRACTICAL':
      blocks = [
        {
          classType: 'practical' as const,
          periodCount: 3,
          label: 'Practical class',
        },
        ...Array.from(
          { length: Math.max(0, roundedCredits - 1) },
          (_, index) => ({
            classType: 'theory' as const,
            periodCount: 1,
            label: `Theory class ${index + 1}`,
          }),
        ),
      ];
      reasoning.push(
        'Theory-practical subjects were planned as one 3-period lab block plus the remaining 1-period theory meetings.',
      );
      break;
    case 'PRACTICAL_ONLY':
      blocks = Array.from({ length: roundedCredits }, (_, index) => ({
        classType: 'practical' as const,
        periodCount: 3,
        label: `Practical block ${index + 1}`,
      }));
      reasoning.push(
        'Practical-only subjects were spread across days as 3-period lab blocks.',
      );
      break;
    case 'PROJECT':
      blocks = [
        {
          classType: 'tutorial' as const,
          periodCount: 1,
          label: 'Project supervision',
        },
        ...Array.from(
          { length: Math.max(0, roundedCredits - 1) },
          (_, index) => ({
            classType: 'practical' as const,
            periodCount: 3,
            label: `Project work block ${index + 1}`,
          }),
        ),
      ];
      reasoning.push(
        'Project subjects were balanced between 1-period supervision and 3-period work blocks.',
      );
      break;
    case 'INDUSTRIAL_ATTACHMENT':
      blocks = [
        {
          classType: 'tutorial' as const,
          periodCount: 1,
          label: 'Attachment briefing',
        },
      ];
      reasoning.push(
        'Industrial attachment was treated as a 1-period briefing block.',
      );
      break;
    default:
      blocks = Array.from(
        { length: Math.min(roundedCredits, 5) },
        (_, index) => ({
          classType: (includesPractical ? 'practical' : 'theory') as
            | 'practical'
            | 'theory',
          periodCount: includesPractical ? 3 : 1,
          label: `Session ${index + 1}`,
        }),
      );
      reasoning.push(
        'Fallback planner rules: Theory classes use 1 period, Practical classes use 3 periods.',
      );
      break;
  }

  if (
    includesPractical &&
    !blocks.some((block) => block.classType === 'practical')
  ) {
    blocks.push({
      classType: 'practical',
      periodCount: 3,
      label: 'Practical class',
    });
    reasoning.push(
      'Added one 3-period practical block because the marking scheme contains practical marks.',
    );
  }

  return {
    blocks: blocks.sort((left, right) => right.periodCount - left.periodCount),
    reasoning,
  };
};

const buildContiguousPeriodOptions = (
  periods: TPlannerPeriod[],
  desiredCount: number,
) => {
  const options: Array<{
    startPeriod: number;
    periodCount: number;
    periodNumbers: number[];
    startTimeSnapshot: string;
    endTimeSnapshot: string;
  }> = [];

  for (
    let startIndex = 0;
    startIndex <= periods.length - desiredCount;
    startIndex += 1
  ) {
    const selected = periods.slice(startIndex, startIndex + desiredCount);
    const isContiguous = selected.every((period, index) => {
      if (index === 0) {
        return true;
      }
      return period.periodNo === selected[index - 1].periodNo + 1;
    });

    if (!isContiguous) {
      continue;
    }

    options.push({
      startPeriod: selected[0].periodNo,
      periodCount: desiredCount,
      periodNumbers: selected.map((period) => period.periodNo),
      startTimeSnapshot: selected[0].startTime,
      endTimeSnapshot: selected[selected.length - 1].endTime,
    });
  }

  return options;
};

const sortPlannerBlocks = (blocks: TPlannerCandidateBlock[]) =>
  [...blocks].sort((left, right) => {
    const dayDelta =
      (DaySortOrder[left.day] ?? 0) - (DaySortOrder[right.day] ?? 0);
    if (dayDelta !== 0) {
      return dayDelta;
    }

    return (
      timeToMinutes(left.startTimeSnapshot) -
      timeToMinutes(right.startTimeSnapshot)
    );
  });

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
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Academic Instructor not found !',
    );
  }

  const isAcademicDepartmentExits = await AcademicDepartment.findById(
    payload.academicDepartment,
  );

  if (!isAcademicDepartmentExits) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Academic Department not found !',
    );
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

const buildOfferedSubjectQuery = (queryObj: Record<string, unknown>) => {
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
    query = query.populate(
      'subject',
      'title code credits subjectType markingScheme',
    );
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
    throw new AppError(
      StatusCodes.CONFLICT,
      pickFirstConflictMessage(conflicts),
    );
  }

  const result = await OfferedSubject.create({
    ...payload,
    academicSemester,
    days: resolvedSchedule.days,
    startTime: resolvedSchedule.startTime,
    endTime: resolvedSchedule.endTime,
    scheduleBlocks: resolvedSchedule.scheduleBlocks,
    markingSchemeSnapshot: cloneMarkingScheme(isSubjectExits.markingScheme),
    assessmentComponentsSnapshot: ensureAssessmentComponentsComplete(
      isSubjectExits.markingScheme,
      cloneAssessmentComponents(isSubjectExits.assessmentComponents),
    ).assessmentComponents,
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
            {
              $eq: [{ $size: { $ifNull: ['$preRequisiteSubjectIds', []] } }, 0],
            },
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
      registrations.find((item) => item.status === 'ONGOING') ??
      registrations[0];

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
    .populate(
      'scheduleBlocks.room',
      'roomName roomNumber buildingNumber capacity',
    );

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
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found.',
    );
  }

  const academicDepartment = await AcademicDepartment.findById(
    payload.academicDepartment,
  ).select('_id');

  if (!academicDepartment) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found.');
  }

  const instructor = await Instructor.findById(payload.instructor).select(
    '_id',
  );

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

const planOfferedSubjectScheduleIntoDB = async (
  payload: TOfferedSubjectSchedulePlanInput,
): Promise<TOfferedSubjectSchedulePlan> => {
  const {
    semesterRegistration,
    academicInstructor,
    academicDepartment,
    subject,
    instructor,
    maxCapacity,
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
      'Schedule planning is only available for active or upcoming semester registrations.',
    );
  }

  const selectedSubject = await Subject.findById(subject).select(
    'title code credits subjectType markingScheme',
  );

  if (!selectedSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found !');
  }

  const activePeriodConfig =
    await PeriodConfigServices.getActivePeriodConfigFromDB();
  const schedulablePeriods = [...(activePeriodConfig.periods ?? [])]
    .filter((period) => period.isActive !== false && period.isBreak !== true)
    .sort((left, right) => left.periodNo - right.periodNo)
    .map((period) => ({
      periodNo: period.periodNo,
      startTime: period.startTime,
      endTime: period.endTime,
    }));

  if (!schedulablePeriods.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No schedulable periods were found in the active period configuration.',
    );
  }

  const candidateRooms = (await Room.find({
    isActive: true,
    capacity: { $gte: maxCapacity },
  })
    .select('_id roomName roomNumber buildingNumber capacity roomType')
    .sort({ capacity: 1, buildingNumber: 1, roomNumber: 1 })) as TPlannerRoom[];

  if (!candidateRooms.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No active room can support the requested maximum capacity.',
    );
  }

  const existingSubjects = await fetchComparableOfferedSubjects(
    semesterRegistration.toString(),
  );

  const { blocks: blueprintBlocks, reasoning } = buildSubjectMeetingBlueprint({
    credits: selectedSubject.credits,
    subjectType: selectedSubject.subjectType,
    markingScheme: selectedSubject.markingScheme,
  });

  const plannedBlocks: TPlannerCandidateBlock[] = [];
  const warnings: string[] = [
    'Planner used Sunday to Thursday as working days and kept Friday/Saturday free.',
  ];

  for (const blueprint of blueprintBlocks) {
    // Filter and Sort rooms based on classType and roomType
    const isTheoryClass = blueprint.classType === 'theory';
    const isPracticalClass = blueprint.classType === 'practical';

    const eligibleRooms = candidateRooms.filter((room) => {
      if (isPracticalClass) {
        // Practical classes MUST be in practical or both type rooms
        return room.roomType === 'practical' || room.roomType === 'both';
      }
      // Theory classes can use any room (fallback to practical if theory/both full)
      return true;
    });

    const sortedRooms = [...eligibleRooms].sort((a, b) => {
      if (isTheoryClass) {
        // Priority for theory: theory > both > practical
        const score = (r: TPlannerRoom) => {
          if (r.roomType === 'theory') return 0;
          if (r.roomType === 'both') return 1;
          return 2;
        };
        return score(a) - score(b) || a.capacity - b.capacity;
      } else if (isPracticalClass) {
        // Priority for practical: practical > both
        const score = (r: TPlannerRoom) => {
          if (r.roomType === 'practical') return 0;
          if (r.roomType === 'both') return 1;
          return 2;
        };
        return score(a) - score(b) || a.capacity - b.capacity;
      }

      // Fallback: sort by capacity
      return a.capacity - b.capacity;
    });

    const dayOrder = [...PLANNER_WORKING_DAYS].sort((left, right) => {
      const leftCount = plannedBlocks.filter(
        (block) => block.day === left,
      ).length;
      const rightCount = plannedBlocks.filter(
        (block) => block.day === right,
      ).length;
      if (leftCount !== rightCount) {
        return leftCount - rightCount;
      }
      return (
        PLANNER_WORKING_DAYS.indexOf(left) - PLANNER_WORKING_DAYS.indexOf(right)
      );
    });

    let matchedBlock: TPlannerCandidateBlock | null = null;
    const periodCountOptions: number[] = [];
    for (
      let currentPeriodCount = blueprint.periodCount;
      currentPeriodCount >=
      (blueprint.minimumPeriodCount ?? blueprint.periodCount);
      currentPeriodCount -= 1
    ) {
      periodCountOptions.push(currentPeriodCount);
    }

    for (const day of dayOrder) {
      for (const periodCount of periodCountOptions) {
        const periodOptions = buildContiguousPeriodOptions(
          schedulablePeriods,
          periodCount,
        );

        for (const option of periodOptions) {
          for (const room of sortedRooms) {
            const candidate: TPlannerCandidateBlock = {
              classType: blueprint.classType,
              day,
              room: room._id,
              startPeriod: option.startPeriod,
              periodCount: option.periodCount,
              periodNumbers: option.periodNumbers,
              startTimeSnapshot: option.startTimeSnapshot,
              endTimeSnapshot: option.endTimeSnapshot,
              roomLabel: buildRoomLabel(room),
              instructorId: instructor.toString(),
            };

            const overlapsWithCurrentPlan = plannedBlocks.some((plannedBlock) =>
              doScheduleBlocksOverlap(plannedBlock, candidate),
            );
            if (overlapsWithCurrentPlan) {
              continue;
            }

            const conflicts = collectScheduleConflicts(
              [candidate],
              existingSubjects,
              {
                instructorId: instructor.toString(),
                academicDepartmentId: academicDepartment.toString(),
              },
            );

            if (conflicts.length) {
              continue;
            }

            matchedBlock = candidate;
            if (periodCount < blueprint.periodCount) {
              warnings.push(
                `${blueprint.label} was reduced from ${blueprint.periodCount} period(s) to ${periodCount} period(s) because no longer block was free.`,
              );
            }
            break;
          }

          if (matchedBlock) {
            break;
          }
        }

        if (matchedBlock) {
          break;
        }
      }

      if (matchedBlock) {
        break;
      }
    }

    if (!matchedBlock) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `Unable to find a conflict-free slot for ${blueprint.label.toLowerCase()}. Try another instructor, capacity, or period setup.`,
      );
    }

    plannedBlocks.push(matchedBlock);
  }

  const resolvedSchedule = await resolveSchedulePayload(
    plannedBlocks.map((block) => ({
      classType: block.classType,
      day: block.day,
      room: block.room,
      startPeriod: block.startPeriod,
      periodCount: block.periodCount,
    })),
    maxCapacity,
  );

  const roomLabelMap = new Map(
    plannedBlocks.map((block) => [block.room.toString(), block.roomLabel]),
  );
  const suggestedBlocks: TOfferedSubjectSchedulePlanSuggestionBlock[] =
    sortPlannerBlocks(
      resolvedSchedule.scheduleBlocks.map((block) => ({
        ...block,
        roomLabel:
          roomLabelMap.get(block.room.toString()) ?? block.room.toString(),
        instructorId: instructor.toString(),
      })),
    ).map((block) => ({
      classType: block.classType,
      day: block.day,
      room: block.room.toString(),
      startPeriod: block.startPeriod,
      periodCount: block.periodCount,
      periodNumbers: block.periodNumbers,
      startTimeSnapshot: block.startTimeSnapshot,
      endTimeSnapshot: block.endTimeSnapshot,
      roomLabel: block.roomLabel,
    }));

  const theoryCount = suggestedBlocks.filter(
    (block) => block.classType === 'theory',
  ).length;
  const practicalCount = suggestedBlocks.filter(
    (block) => block.classType === 'practical',
  ).length;
  const tutorialCount = suggestedBlocks.filter(
    (block) => block.classType === 'tutorial',
  ).length;

  return {
    summary: `${selectedSubject.title} was planned into ${suggestedBlocks.length} weekly block(s): ${theoryCount} theory, ${practicalCount} practical, ${tutorialCount} tutorial.`,
    reasoning,
    warnings,
    suggestedBlocks,
    planningMeta: {
      subjectTitle: selectedSubject.title,
      subjectCode: selectedSubject.code,
      credits: selectedSubject.credits,
      subjectType: selectedSubject.subjectType,
      preferredWorkingDays: [...PLANNER_WORKING_DAYS],
      totalExistingOfferedSubjects: existingSubjects.length,
    },
  };
};

const updateOfferedSubjectIntoDB = async (
  id: string,
  payload: Pick<
    TOfferedSubject,
    'instructor' | 'maxCapacity' | 'scheduleBlocks'
  >,
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
      academicDepartmentId:
        isOfferedSubjectExists.academicDepartment.toString(),
    },
  );

  if (conflicts.length) {
    throw new AppError(
      StatusCodes.CONFLICT,
      pickFirstConflictMessage(conflicts),
    );
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

const planBulkOfferedSubjectScheduleIntoDB = async (
  payload: TBulkOfferedSubjectSchedulePlanInput,
): Promise<TBulkOfferedSubjectSchedulePlan> => {
  const { semesterRegistration, academicDepartment, entries } = payload;

  if (!entries.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one subject entry is required for bulk planning.',
    );
  }

  const registration =
    await SemesterRegistration.findById(semesterRegistration);
  if (!registration) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found !',
    );
  }

  if (registration.status === 'ENDED') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Schedule planning is only available for active or upcoming registrations.',
    );
  }

  const activePeriodConfig =
    await PeriodConfigServices.getActivePeriodConfigFromDB();
  const schedulablePeriods = [...(activePeriodConfig.periods ?? [])]
    .filter((period) => period.isActive !== false && period.isBreak !== true)
    .sort((left, right) => left.periodNo - right.periodNo)
    .map((period) => ({
      periodNo: period.periodNo,
      startTime: period.startTime,
      endTime: period.endTime,
    }));

  if (!schedulablePeriods.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No schedulable periods found.',
    );
  }

  const existingSubjects = await fetchComparableOfferedSubjects(
    semesterRegistration.toString(),
  );
  const batchPlannedBlocks: TPlannerCandidateBlock[] = [];
  const plans: (TOfferedSubjectSchedulePlan & { subjectId: string })[] = [];

  for (const entry of entries) {
    const selectedSubject = await Subject.findById(entry.subject).select(
      'title code credits subjectType markingScheme',
    );
    if (!selectedSubject) continue;

    const candidateRooms = (await Room.find({
      isActive: true,
      capacity: { $gte: entry.maxCapacity },
    }).select(
      '_id roomName roomNumber buildingNumber capacity roomType',
    )) as (TPlannerRoom & { roomType: string })[];

    if (!candidateRooms.length) continue;

    const { blocks: blueprintBlocks, reasoning } = buildSubjectMeetingBlueprint(
      {
        credits: selectedSubject.credits,
        subjectType: selectedSubject.subjectType,
        markingScheme: selectedSubject.markingScheme,
      },
    );

    const currentSubjectPlannedBlocks: TPlannerCandidateBlock[] = [];
    const warnings: string[] = [];

    for (const blueprint of blueprintBlocks) {
      // Filter and Sort rooms based on classType and roomType
      const isTheoryClass = blueprint.classType === 'theory';
      const isPracticalClass = blueprint.classType === 'practical';

      const eligibleRooms = candidateRooms.filter((room) => {
        if (isPracticalClass) {
          // Practical classes MUST be in practical or both type rooms
          return room.roomType === 'practical' || room.roomType === 'both';
        }
        // Theory classes can use any room (fallback to practical if theory/both full)
        return true;
      });

      const sortedRooms = [...eligibleRooms].sort((a, b) => {
        if (isTheoryClass) {
          // Priority for theory: theory > both > practical
          const score = (r: TPlannerRoom) => {
            if (r.roomType === 'theory') return 0;
            if (r.roomType === 'both') return 1;
            return 2;
          };
          return score(a) - score(b) || a.capacity - b.capacity;
        } else if (isPracticalClass) {
          // Priority for practical: practical > both
          const score = (r: TPlannerRoom) => {
            if (r.roomType === 'practical') return 0;
            if (r.roomType === 'both') return 1;
            return 2;
          };
          return score(a) - score(b) || a.capacity - b.capacity;
        }

        // Fallback: sort by capacity
        return a.capacity - b.capacity;
      });

      const dayOrder = [...PLANNER_WORKING_DAYS].sort((left, right) => {
        const leftCount =
          batchPlannedBlocks.filter((b) => b.day === left).length +
          currentSubjectPlannedBlocks.filter((b) => b.day === left).length;
        const rightCount =
          batchPlannedBlocks.filter((b) => b.day === right).length +
          currentSubjectPlannedBlocks.filter((b) => b.day === right).length;
        return (
          leftCount - rightCount ||
          PLANNER_WORKING_DAYS.indexOf(left) -
            PLANNER_WORKING_DAYS.indexOf(right)
        );
      });

      let matchedBlock: TPlannerCandidateBlock | null = null;
      const periodCountOptions = Array.from(
        {
          length:
            blueprint.periodCount -
            (blueprint.minimumPeriodCount ?? blueprint.periodCount) +
            1,
        },
        (_, i) => blueprint.periodCount - i,
      );

      for (const day of dayOrder) {
        for (const periodCount of periodCountOptions) {
          const periodOptions = buildContiguousPeriodOptions(
            schedulablePeriods,
            periodCount,
          );
          for (const option of periodOptions) {
            for (const room of sortedRooms) {
              const candidate: TPlannerCandidateBlock = {
                classType: blueprint.classType,
                day,
                room: room._id,
                startPeriod: option.startPeriod,
                periodCount: option.periodCount,
                periodNumbers: option.periodNumbers,
                startTimeSnapshot: option.startTimeSnapshot,
                endTimeSnapshot: option.endTimeSnapshot,
                roomLabel: buildRoomLabel(room),
                instructorId: entry.instructor.toString(),
              };

              const internalConflict = [
                ...batchPlannedBlocks,
                ...currentSubjectPlannedBlocks,
              ].some((b) => doScheduleBlocksOverlap(b, candidate));
              if (internalConflict) continue;

              const externalConflicts = collectScheduleConflicts(
                [candidate],
                existingSubjects,
                {
                  instructorId: entry.instructor.toString(),
                  academicDepartmentId: academicDepartment.toString(),
                },
              );
              if (externalConflicts.length) continue;

              matchedBlock = candidate;
              break;
            }
            if (matchedBlock) break;
          }
          if (matchedBlock) break;
        }
        if (matchedBlock) break;
      }

      if (matchedBlock) {
        currentSubjectPlannedBlocks.push(matchedBlock);
      } else {
        warnings.push(`Could not find a slot for ${blueprint.label}.`);
      }
    }

    if (currentSubjectPlannedBlocks.length) {
      batchPlannedBlocks.push(...currentSubjectPlannedBlocks);
      const resolved = await resolveSchedulePayload(
        currentSubjectPlannedBlocks.map((b) => ({
          classType: b.classType,
          day: b.day,
          room: b.room,
          startPeriod: b.startPeriod,
          periodCount: b.periodCount,
        })),
        entry.maxCapacity,
      );

      const roomLabelMap = new Map(
        currentSubjectPlannedBlocks.map((b) => [
          b.room.toString(),
          b.roomLabel,
        ]),
      );
      const suggestedBlocks: TOfferedSubjectSchedulePlanSuggestionBlock[] =
        sortPlannerBlocks(
          resolved.scheduleBlocks.map((b) => ({
            ...b,
            roomLabel: roomLabelMap.get(b.room.toString()) ?? b.room.toString(),
            instructorId: entry.instructor.toString(),
          })),
        ).map((b) => ({
          classType: b.classType,
          day: b.day,
          room: b.room.toString(),
          startPeriod: b.startPeriod,
          periodCount: b.periodCount,
          periodNumbers: b.periodNumbers,
          startTimeSnapshot: b.startTimeSnapshot,
          endTimeSnapshot: b.endTimeSnapshot,
          roomLabel: b.roomLabel,
        }));

      plans.push({
        subjectId: entry.subject.toString(),
        summary: `${selectedSubject.title} planned with ${suggestedBlocks.length} blocks.`,
        reasoning,
        warnings,
        suggestedBlocks,
        planningMeta: {
          subjectTitle: selectedSubject.title,
          subjectCode: selectedSubject.code,
          credits: selectedSubject.credits,
          subjectType: selectedSubject.subjectType,
          preferredWorkingDays: [...PLANNER_WORKING_DAYS],
          totalExistingOfferedSubjects: existingSubjects.length,
        },
      });
    }
  }

  return {
    plans,
    summary: `Bulk plan generated for ${plans.length} subjects.`,
  };
};

export const OfferedSubjectServices = {
  createOfferedSubjectIntoDB,
  getAllOfferedSubjectsFromDB,
  getMyOfferedSubjectFromDB,
  getSingleOfferedSubjectFromDB,
  previewOfferedSubjectConflictsIntoDB,
  planOfferedSubjectScheduleIntoDB,
  planBulkOfferedSubjectScheduleIntoDB,
  deleteOfferedSubjectFromDB,
  updateOfferedSubjectIntoDB,
};
