import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { PeriodConfigServices } from '../periodConfig/periodConfig.service.js';
import { Room } from '../room/room.model.js';
import { DaySortOrder, timeToMinutes } from './OfferedSubject.constant.js';
import type {
  TDays,
  TOfferedSubject,
  TScheduleBlock,
  TScheduleBlockInput,
} from './OfferedSubject.interface.js';

type TScheduleLikeBlock = {
  day: TDays;
  room?: { toString(): string } | string | null;
  startTimeSnapshot: string;
  endTimeSnapshot: string;
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
  const dayDelta = (DaySortOrder[left.day] ?? 0) - (DaySortOrder[right.day] ?? 0);
  if (dayDelta !== 0) {
    return dayDelta;
  }

  return (
    timeToMinutes(left.startTimeSnapshot) - timeToMinutes(right.startTimeSnapshot)
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

const buildScheduleSummary = (scheduleBlocks: TScheduleBlock[]) => {
  if (!scheduleBlocks.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'At least one schedule block is required.');
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

const resolveBlocksAgainstActiveConfig = async (
  blocks: TScheduleBlockInput[],
): Promise<TScheduleBlock[]> => {
  const activeConfig = await PeriodConfigServices.getActivePeriodConfigFromDB();
  const validPeriods = [...(activeConfig.periods ?? [])]
    .filter((period) => period.isActive !== false && period.isBreak !== true)
    .sort((left, right) => left.periodNo - right.periodNo);

  const uniqueRoomIds = Array.from(new Set(blocks.map((block) => block.room.toString())));
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

    for (let otherIndex = index + 1; otherIndex < scheduleBlocks.length; otherIndex += 1) {
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

  const uniqueRoomIds = Array.from(new Set(resolvedBlocks.map((block) => block.room.toString())));
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
      room:
        typeof block.room === 'string'
          ? block.room
          : block.room?.toString?.() ?? null,
      startTimeSnapshot: block.startTimeSnapshot,
      endTimeSnapshot: block.endTimeSnapshot,
    }));
  }

  if (offeredSubject.days?.length && offeredSubject.startTime && offeredSubject.endTime) {
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
      const existingInstructorId =
        typeof existingSubject.instructor === 'string'
          ? existingSubject.instructor
          : existingSubject.instructor?.toString?.();
      const existingDepartmentId =
        typeof existingSubject.academicDepartment === 'string'
          ? existingSubject.academicDepartment
          : existingSubject.academicDepartment?.toString?.();

      if (existingInstructorId && existingInstructorId === context.instructorId) {
        conflicts.push({
          type: 'INSTRUCTOR_CONFLICT',
          message: `Instructor already has another class on ${scheduleBlock.day} during ${scheduleBlock.startTimeSnapshot}-${scheduleBlock.endTimeSnapshot}.`,
          blockIndex: index,
          conflictingOfferedSubjectId: existingId,
        });
      }

      const roomConflict = existingBlocks.some(
        (existingBlock) =>
          existingBlock.room &&
          existingBlock.room === scheduleBlock.room.toString() &&
          doScheduleBlocksOverlap(scheduleBlock, existingBlock),
      );

      if (roomConflict) {
        conflicts.push({
          type: 'ROOM_CONFLICT',
          message: `Selected room is already booked on ${scheduleBlock.day} during ${scheduleBlock.startTimeSnapshot}-${scheduleBlock.endTimeSnapshot}.`,
          blockIndex: index,
          conflictingOfferedSubjectId: existingId,
        });
      }

      if (existingDepartmentId && existingDepartmentId === context.academicDepartmentId) {
        conflicts.push({
          type: 'DEPARTMENT_CONFLICT',
          message: `This department already has another class on ${scheduleBlock.day} during ${scheduleBlock.startTimeSnapshot}-${scheduleBlock.endTimeSnapshot}.`,
          blockIndex: index,
          conflictingOfferedSubjectId: existingId,
        });
      }
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
