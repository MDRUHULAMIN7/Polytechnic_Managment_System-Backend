import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { PeriodConfigServices } from '../periodConfig/periodConfig.service.js';
import { Room } from '../room/room.model.js';
import { OfferedSubject } from './OfferedSubject.model.js';
import { DaySortOrder, timeToMinutes } from './OfferedSubject.constant.js';
import type {
  TDays,
  TOfferedSubject,
  TPlannerBlueprint,
  TPlannerCandidateBlock,
  TPlannerPeriod,
  TPlannerRoom,
  TScheduleBlock,
  TScheduleBlockInput,
} from './OfferedSubject.interface.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { AcademicInstructor } from '../academicInstructor/academicInstructor.model.js';
import { AcademicDepartment } from '../academicDepartment/academicDepartment.model.js';
import { Subject } from '../subject/subject.model.js';

type TScheduleLikeBlock = {
  day: TDays;
  /** Room id (string) or BSON ref; overlap checks only use day + time. */
  room?: { toString(): string } | string | null;
  startTimeSnapshot: string;
  endTimeSnapshot: string;
  /** When set, room overlap matches the admin UI (day + period indices). */
  periodNumbers?: number[];
  startPeriod?: number;
  periodCount?: number;
};

/**
 * Normalize ObjectId refs for comparisons. Handles string ids, BSON ObjectIds,
 * and populated lean docs where `toString()` would otherwise yield "[object Object]".
 * Avoids recursing on `value._id` when it is the same reference as `value` (Mongoose ObjectId).
 */
export const toComparableObjectIdString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length ? t.toLowerCase() : undefined;
  }
  if (typeof value === 'object') {
    const rec = value as { _id?: unknown; toString?: () => string };
    // Mongoose ObjectId's `_id` getter can return `this` — never recurse into self.
    if (
      rec._id !== null &&
      rec._id !== undefined &&
      rec._id !== value
    ) {
      return toComparableObjectIdString(rec._id);
    }
    if (typeof rec.toString === 'function') {
      const s = rec.toString.call(value).trim();
      if (s.length && s !== '[object Object]') {
        return s.toLowerCase();
      }
    }
  }
  return undefined;
};

export type TResolvedSchedulePayload = {
  scheduleBlocks: TScheduleBlock[];
  days: TDays[];
  startTime: string;
  endTime: string;
};

export type TScheduleConflict = {
  type:
    | 'INTERNAL_DUPLICATE'
    | 'ROOM_CAPACITY'
    | 'INSTRUCTOR_CONFLICT'
    | 'ROOM_CONFLICT'
    | 'DEPARTMENT_CONFLICT';
  message: string;
  blockIndex: number;
  conflictingOfferedSubjectId?: string;
};

const compareBlocks = (left: TScheduleLikeBlock, right: TScheduleLikeBlock) => {
  const dayDelta =
    (DaySortOrder[left.day] ?? 0) - (DaySortOrder[right.day] ?? 0);
  if (dayDelta !== 0) {
    return dayDelta;
  }

  return (
    timeToMinutes(left.startTimeSnapshot) -
    timeToMinutes(right.startTimeSnapshot)
  );
};

export const doTimeRangesOverlap = (
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) =>
  timeToMinutes(firstStart) < timeToMinutes(secondEnd) &&
  timeToMinutes(firstEnd) > timeToMinutes(secondStart);

export const doScheduleBlocksOverlap = (
  first: TScheduleLikeBlock,
  second: TScheduleLikeBlock,
) =>
  first.day === second.day &&
  doTimeRangesOverlap(
    first.startTimeSnapshot,
    first.endTimeSnapshot,
    second.startTimeSnapshot,
    second.endTimeSnapshot,
  );

/**
 * Period indices occupied by a block — same rule as the admin room grid
 * (`startPeriod` .. `startPeriod + periodCount - 1`), preferring `periodNumbers` when present.
 */
const expandComparablePeriodNumbers = (
  block: TScheduleLikeBlock,
): number[] | undefined => {
  if (block.periodNumbers?.length) {
    return block.periodNumbers;
  }
  if (
    typeof block.startPeriod === 'number' &&
    typeof block.periodCount === 'number' &&
    block.startPeriod > 0 &&
    block.periodCount > 0
  ) {
    const out: number[] = [];
    for (
      let p = block.startPeriod;
      p < block.startPeriod + block.periodCount;
      p += 1
    ) {
      out.push(p);
    }
    return out;
  }
  return undefined;
};

/**
 * Room / admin-style overlap: same calendar day and shared period slot when both
 * blocks expose period data; otherwise fall back to snapshot times (legacy rows).
 */
export const doScheduleBlocksOverlapByPeriodOrTime = (
  first: TScheduleLikeBlock,
  second: TScheduleLikeBlock,
): boolean => {
  if (first.day !== second.day) {
    return false;
  }
  const firstPeriods = expandComparablePeriodNumbers(first);
  const secondPeriods = expandComparablePeriodNumbers(second);
  if (firstPeriods?.length && secondPeriods?.length) {
    const secondSet = new Set(secondPeriods);
    return firstPeriods.some((p) => secondSet.has(p));
  }
  return doScheduleBlocksOverlap(first, second);
};

const buildScheduleSummary = (scheduleBlocks: TScheduleBlock[]) => {
  if (!scheduleBlocks.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one schedule block is required.',
    );
  }

  const sorted = [...scheduleBlocks].sort(compareBlocks);
  const days = Array.from(new Set(sorted.map((block) => block.day)));
  const startTime = sorted.reduce((current, block) => {
    if (!current) {
      return block.startTimeSnapshot;
    }
    return timeToMinutes(block.startTimeSnapshot) < timeToMinutes(current)
      ? block.startTimeSnapshot
      : current;
  }, '');
  const endTime = sorted.reduce((current, block) => {
    if (!current) {
      return block.endTimeSnapshot;
    }
    return timeToMinutes(block.endTimeSnapshot) > timeToMinutes(current)
      ? block.endTimeSnapshot
      : current;
  }, '');

  return {
    days,
    startTime,
    endTime,
  };
};

export const validateScheduleBlocksForSubject = (
  subject: {
    credits: number;
    theoryPeriodsPerWeek?: number;
    practicalPeriodsPerWeek?: number;
  },
  scheduleBlocks: TScheduleBlock[],
) => {
  const theoryCount = scheduleBlocks.filter(
    (b) => b.classType === 'theory',
  ).length;
  const practicalCount = scheduleBlocks.filter(
    (b) => b.classType === 'practical',
  ).length;

  // 1. Weekly Theory Classes
  const requiredTheory = subject.theoryPeriodsPerWeek ?? 0;
  if (theoryCount !== requiredTheory) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Theory class mismatch. Required: ${requiredTheory}, Assigned: ${theoryCount}.`,
    );
  }

  // 2. Practical Class Calculation Logic (1 class per 3 periods)
  const requiredPracticalPeriods = subject.practicalPeriodsPerWeek ?? 0;
  const expectedPracticalClasses = Math.floor(requiredPracticalPeriods / 3);
  if (practicalCount !== expectedPracticalClasses) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Practical class mismatch. Required: ${expectedPracticalClasses} (for ${requiredPracticalPeriods} periods), Assigned: ${practicalCount}.`,
    );
  }

  // 3. Total Classes vs Credits
  const totalClasses = theoryCount + practicalCount;
  if (totalClasses !== subject.credits) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Total classes (${totalClasses}) must match subject credits (${subject.credits}).`,
    );
  }

  // 4. No multiple classes of same subject in a day
  const daysWithClasses = new Set<string>();
  for (const b of scheduleBlocks) {
    if (daysWithClasses.has(b.day)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `একদিনে একই সাবজেক্টের একাধিক ক্লাস বরাদ্দ করা যাবে না (${b.day})`,
      );
    }
    daysWithClasses.add(b.day);
  }
};

const resolveBlocksAgainstActiveConfig = async (
  blocks: TScheduleBlockInput[],
  shift?: string,
): Promise<TScheduleBlock[]> => {
  const activeConfig = await PeriodConfigServices.getActivePeriodConfigFromDB(shift);
  const validPeriods = [...(activeConfig.periods ?? [])]
    .filter((period) => period.isActive !== false && period.isBreak !== true)
    .sort((left, right) => left.periodNo - right.periodNo);

  const uniqueRoomIds = Array.from(
    new Set(blocks.map((block) => block.room.toString())),
  );
  const rooms = await Room.find({
    _id: { $in: uniqueRoomIds },
  }).select('_id capacity isActive roomName roomNumber buildingNumber');

  const roomMap = new Map(rooms.map((room) => [room._id.toString(), room]));

  return blocks.map((block) => {
    const resolvedRoom = roomMap.get(block.room.toString());
    if (!resolvedRoom) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Selected room was not found.');
    }

    if (resolvedRoom.isActive === false) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Room ${resolvedRoom.roomName} is inactive and can not be assigned.`,
      );
    }

    const contiguousPeriods = validPeriods.filter(
      (period) =>
        period.periodNo >= block.startPeriod &&
        period.periodNo < block.startPeriod + block.periodCount,
    );

    if (contiguousPeriods.length !== block.periodCount) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Selected periods for ${block.day} do not match the active period configuration.`,
      );
    }

    for (let index = 1; index < contiguousPeriods.length; index += 1) {
      const previous = contiguousPeriods[index - 1];
      const current = contiguousPeriods[index];

      if (current.periodNo !== previous.periodNo + 1) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          `Selected periods for ${block.day} must be contiguous.`,
        );
      }
    }

    return {
      ...block,
      periodNumbers: contiguousPeriods.map((period) => period.periodNo),
      startTimeSnapshot: contiguousPeriods[0].startTime,
      endTimeSnapshot: contiguousPeriods[contiguousPeriods.length - 1].endTime,
    };
  });
};

const ensureNoInternalScheduleOverlap = (scheduleBlocks: TScheduleBlock[]) => {
  for (let index = 0; index < scheduleBlocks.length; index += 1) {
    const current = scheduleBlocks[index];

    for (
      let otherIndex = index + 1;
      otherIndex < scheduleBlocks.length;
      otherIndex += 1
    ) {
      const other = scheduleBlocks[otherIndex];
      if (!doScheduleBlocksOverlap(current, other)) {
        continue;
      }

      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Schedule blocks ${index + 1} and ${otherIndex + 1} overlap on ${current.day}.`,
      );
    }
  }
};

export const resolveSchedulePayload = async (
  blocks: TScheduleBlockInput[],
  maxCapacity: number,
  shift?: string,
): Promise<TResolvedSchedulePayload> => {
  const resolvedBlocks = await resolveBlocksAgainstActiveConfig(blocks, shift);
  ensureNoInternalScheduleOverlap(resolvedBlocks);

  const uniqueRoomIds = Array.from(
    new Set(resolvedBlocks.map((block) => block.room.toString())),
  );
  const rooms = await Room.find({
    _id: { $in: uniqueRoomIds },
  }).select('_id capacity roomName roomNumber buildingNumber');
  const roomMap = new Map(rooms.map((room) => [room._id.toString(), room]));

  resolvedBlocks.forEach((block) => {
    const room = roomMap.get(block.room.toString());
    if (room && room.capacity < maxCapacity) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `${room.roomName} capacity is lower than the offered subject capacity.`,
      );
    }
  });

  const summary = buildScheduleSummary(resolvedBlocks);

  return {
    scheduleBlocks: [...resolvedBlocks].sort(compareBlocks),
    days: summary.days,
    startTime: summary.startTime,
    endTime: summary.endTime,
  };
};

export const extractComparableScheduleBlocks = (
  offeredSubject: Partial<TOfferedSubject> & {
    _id?: { toString(): string } | string;
  },
): TScheduleLikeBlock[] => {
  if (offeredSubject.scheduleBlocks?.length) {
    return offeredSubject.scheduleBlocks.map((block) => ({
      day: block.day,
      room: toComparableObjectIdString(block.room) ?? null,
      startTimeSnapshot: block.startTimeSnapshot,
      endTimeSnapshot: block.endTimeSnapshot,
      periodNumbers: block.periodNumbers?.length ? block.periodNumbers : undefined,
      startPeriod: block.startPeriod,
      periodCount: block.periodCount,
    }));
  }

  if (
    offeredSubject.days?.length &&
    offeredSubject.startTime &&
    offeredSubject.endTime
  ) {
    return offeredSubject.days.map((day) => ({
      day,
      room: null,
      startTimeSnapshot: offeredSubject.startTime as string,
      endTimeSnapshot: offeredSubject.endTime as string,
    }));
  }

  return [];
};

export const collectScheduleConflicts = (
  scheduleBlocks: TScheduleBlock[],
  existingSubjects: Array<
    Partial<TOfferedSubject> & {
      _id?: { toString(): string } | string;
      instructor?: { toString(): string } | string;
      academicDepartment?: { toString(): string } | string;
    }
  >,
  context: {
    instructorId: string;
    academicDepartmentId: string;
  },
) => {
  const conflicts: TScheduleConflict[] = [];

  const contextInstructorKey = toComparableObjectIdString(context.instructorId);

  scheduleBlocks.forEach((scheduleBlock, index) => {
    existingSubjects.forEach((existingSubject) => {
      const existingBlocks = extractComparableScheduleBlocks(existingSubject);
      if (!existingBlocks.length) {
        return;
      }

      const hasOverlap = existingBlocks.some((existingBlock) =>
        doScheduleBlocksOverlap(scheduleBlock, existingBlock),
      );

      if (!hasOverlap) {
        return;
      }

      const existingId =
        typeof existingSubject._id === 'string'
          ? existingSubject._id
          : existingSubject._id?.toString?.();
      const existingInstructorKey = toComparableObjectIdString(
        existingSubject.instructor,
      );

      if (
        existingInstructorKey &&
        contextInstructorKey &&
        existingInstructorKey === contextInstructorKey
      ) {
        conflicts.push({
          type: 'INSTRUCTOR_CONFLICT',
          message: `Instructor already has another class on ${scheduleBlock.day} during ${scheduleBlock.startTimeSnapshot}-${scheduleBlock.endTimeSnapshot}.`,
          blockIndex: index,
          conflictingOfferedSubjectId: existingId,
        });
      }

      const candidateRoomKey = toComparableObjectIdString(
        scheduleBlock.room as unknown,
      );

      const roomConflict = existingBlocks.some((existingBlock) => {
        const existingRoomKey = toComparableObjectIdString(
          existingBlock.room as unknown,
        );
        return (
          Boolean(existingRoomKey) &&
          Boolean(candidateRoomKey) &&
          existingRoomKey === candidateRoomKey &&
          doScheduleBlocksOverlapByPeriodOrTime(scheduleBlock, existingBlock)
        );
      });

      if (roomConflict) {
        conflicts.push({
          type: 'ROOM_CONFLICT',
          message: `Selected room is already booked on ${scheduleBlock.day} during ${scheduleBlock.startTimeSnapshot}-${scheduleBlock.endTimeSnapshot}.`,
          blockIndex: index,
          conflictingOfferedSubjectId: existingId,
        });
      }

      // Note: We intentionally do NOT flag DEPARTMENT_CONFLICT for overlapping times in different rooms.
      // Same department often runs multiple parallel sections; room + instructor checks are sufficient.
    });
  });

  const deduped = new Map<string, TScheduleConflict>();

  conflicts.forEach((conflict) => {
    const key = [
      conflict.type,
      conflict.blockIndex,
      conflict.conflictingOfferedSubjectId ?? '',
      conflict.message,
    ].join(':');
    if (!deduped.has(key)) {
      deduped.set(key, conflict);
    }
  });

  return Array.from(deduped.values());
};

export const fetchComparableOfferedSubjects = async (
  semesterRegistrationId: string,
  excludeOfferedSubjectId?: string,
) => {
  return OfferedSubject.find({
    semesterRegistration: semesterRegistrationId,
    ...(excludeOfferedSubjectId
      ? { _id: { $ne: excludeOfferedSubjectId } }
      : {}),
  }).select(
    'instructor academicDepartment scheduleBlocks days startTime endTime',
  );
};

/** Bulk plan: different instructors may run parallel in different rooms; only block same instructor or same room overlap. */
export const bulkPlannerCandidateConflictsPlanned = (
  planned: TPlannerCandidateBlock[],
  candidate: TPlannerCandidateBlock,
): boolean =>
  planned.some((block) => {
    if (!doScheduleBlocksOverlapByPeriodOrTime(block, candidate)) {
      return false;
    }
    const sameInstructor =
      Boolean(block.instructorId) &&
      Boolean(candidate.instructorId) &&
      block.instructorId === candidate.instructorId;
    const blockRoomKey = toComparableObjectIdString(block.room);
    const candidateRoomKey = toComparableObjectIdString(candidate.room);
    const sameRoom =
      Boolean(blockRoomKey) &&
      Boolean(candidateRoomKey) &&
      blockRoomKey === candidateRoomKey;
    return sameInstructor || sameRoom;
  });

export const buildRoomLabel = (room: TPlannerRoom) =>
  `${room.roomName} | Building ${room.buildingNumber} | Room ${room.roomNumber} | Cap ${room.capacity}`;

export const buildSubjectMeetingBlueprint = (subject: {
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

export const buildContiguousPeriodOptions = (
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

export const sortPlannerBlocks = (blocks: TPlannerCandidateBlock[]) =>
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

export const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  return instructor._id;
};

export const pickFirstConflictMessage = (
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

export const ensureCommonReferencesExist = async (payload: {
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

export const getRequestedFields = (queryObj: Record<string, unknown>) => {
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

export const shouldPopulateField = (
  requestedFields: Set<string> | null,
  field: string,
) => !requestedFields || requestedFields.has(field);

export const buildOfferedSubjectQuery = (queryObj: Record<string, unknown>) => {
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

export const validateAndResolveOfferedSubject = async (
  payload: Pick<
    TOfferedSubject,
    | 'semesterRegistration'
    | 'academicInstructor'
    | 'academicDepartment'
    | 'subject'
    | 'instructor'
    | 'maxCapacity'
    | 'scheduleBlocks'
  >,
  excludeOfferedSubjectId?: string,
) => {
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

  const resolvedSchedule = await resolveSchedulePayload(
    scheduleBlocks as unknown as TScheduleBlockInput[],
    maxCapacity,
    references.semesterRegistration.shift,
  );

  validateScheduleBlocksForSubject(
    isSubjectExits,
    resolvedSchedule.scheduleBlocks,
  );

  const existingSubjects = await fetchComparableOfferedSubjects(
    semesterRegistration.toString(),
    excludeOfferedSubjectId,
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

  return {
    academicSemester,
    resolvedSchedule,
    isSubjectExits,
    references,
  };
};
