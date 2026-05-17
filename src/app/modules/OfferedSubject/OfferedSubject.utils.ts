import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { PeriodConfigServices } from '../periodConfig/periodConfig.service.js';
import { Room } from '../room/room.model.js';
import { OfferedSubject } from './OfferedSubject.model.js';
import { DaySortOrder, timeToMinutes } from './OfferedSubject.constant.js';
import type {
  TDays,
  TOfferedSubject,
  TScheduleBlock,
  TScheduleBlockInput,
} from './OfferedSubject.interface.js';

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
): Promise<TScheduleBlock[]> => {
  const activeConfig = await PeriodConfigServices.getActivePeriodConfigFromDB();
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
  scheduleBlocks: TScheduleBlockInput[],
  maxCapacity: number,
): Promise<TResolvedSchedulePayload> => {
  const resolvedBlocks = await resolveBlocksAgainstActiveConfig(scheduleBlocks);
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
