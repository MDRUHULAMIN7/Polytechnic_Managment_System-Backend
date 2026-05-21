import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import type {
  TDays,
  TOfferedSubjectClassType,
  TScheduleBlock,
} from '../OfferedSubject/OfferedSubject.interface.js';
import { timeToMinutes } from '../OfferedSubject/OfferedSubject.constant.js';
import { Student } from '../student/student.model.js';
import type {
  TClassSession,
  TFilterOption,
  TSemesterRegistrationOptionSource,
} from './classSession.interface.js';
import { ClassSession } from './classSession.model.js';
import { Subject } from '../subject/subject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import type { Types } from 'mongoose';

const dayByWeekIndex: Record<number, TDays> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const getUtcDayLabel = (date: Date): TDays => {
  return dayByWeekIndex[date.getUTCDay()];
};

export const normalizeUtcDate = (value: Date | string) => {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const formatUtcDateKey = (date: Date) => {
  return normalizeUtcDate(date).toISOString().slice(0, 10);
};

export const isSameUtcDate = (left: Date | string, right: Date | string) =>
  formatUtcDateKey(new Date(left)) === formatUtcDateKey(new Date(right));

export const getTodayUtc = () => normalizeUtcDate(new Date());

export const isBeforeTodayUtc = (value: Date | string) =>
  normalizeUtcDate(value).getTime() < getTodayUtc().getTime();

export const buildUtcMonthRanges = (start: Date | string, end: Date | string) => {
  const normalizedStart = normalizeUtcDate(start);
  const normalizedEnd = normalizeUtcDate(end);
  const ranges: Array<{ start: Date; end: Date }> = [];

  let cursor = new Date(
    Date.UTC(
      normalizedStart.getUTCFullYear(),
      normalizedStart.getUTCMonth(),
      1,
    ),
  );

  while (cursor.getTime() <= normalizedEnd.getTime()) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        0,
      ),
    );

    ranges.push({
      start:
        monthStart.getTime() < normalizedStart.getTime()
          ? normalizedStart
          : monthStart,
      end:
        monthEnd.getTime() > normalizedEnd.getTime() ? normalizedEnd : monthEnd,
    });

    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return ranges;
};

export const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  return instructor._id;
};

export const resolveStudentIdFromUserId = async (userId: string) => {
  const student = await Student.findOne({ id: userId }).select('_id');

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  return student._id;
};

export const formatDateLabel = (value?: Date | string | null) => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
};


export const buildSemesterRegistrationOption = (
  item: TSemesterRegistrationOptionSource | null,
): TFilterOption | null => {
  if (!item?._id) {
    return null;
  }

  const semesterLabel =
    typeof item.academicSemester === 'string'
      ? item.academicSemester
      : [item.academicSemester?.name, item.academicSemester?.year]
          .filter(Boolean)
          .join(' ');

  return {
    value: item._id.toString(),
    label: [
      semesterLabel || 'Semester',
      item.status ?? '--',
      item.shift ?? '--',
      `${formatDateLabel(item.startDate)} -> ${formatDateLabel(item.endDate)}`,
    ].join(' | '),
  };
};

export const buildSubjectOption = (
  item: { _id?: { toString(): string }; title?: string; code?: number } | null,
): TFilterOption | null => {
  if (!item?._id) {
    return null;
  }

  return {
    value: item._id.toString(),
    label: item.code ? `${item.title ?? '--'} (${item.code})` : item.title ?? '--',
  };
};

export const paginate = (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

export const buildSessionFilter = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};

  if (typeof query.status === 'string' && query.status.trim()) {
    filter.status = query.status.trim();
  }

  if (typeof query.instructor === 'string' && query.instructor.trim()) {
    filter.instructor = query.instructor.trim();
  }

  if (typeof query.subject === 'string' && query.subject.trim()) {
    filter.subject = query.subject.trim();
  }

  if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
    const subjects = await Subject.find({
      title: {
        $regex: query.searchTerm.trim(),
        $options: 'i',
      },
    }).select('_id');

    const subjectIds = subjects.map((item) => item._id);
    filter.subject = {
      $in: subjectIds.length ? subjectIds : [],
    };
  }

  if (
    typeof query.academicDepartment === 'string' &&
    query.academicDepartment.trim()
  ) {
    filter.academicDepartment = query.academicDepartment.trim();
  }

  if (typeof query.offeredSubject === 'string' && query.offeredSubject.trim()) {
    filter.offeredSubject = query.offeredSubject.trim();
  }

  if (
    typeof query.semesterRegistration === 'string' &&
    query.semesterRegistration.trim()
  ) {
    filter.semesterRegistration = query.semesterRegistration.trim();
  }

  const range: Record<string, Date> = {};

  if (typeof query.startDate === 'string' && query.startDate.trim()) {
    range.$gte = normalizeUtcDate(query.startDate);
  }

  if (typeof query.endDate === 'string' && query.endDate.trim()) {
    range.$lte = normalizeUtcDate(query.endDate);
  }

  if (Object.keys(range).length) {
    filter.date = range;
  }

  return filter;
};

export const buildSessionQuery = (filter: Record<string, unknown>) => {
  return ClassSession.find(filter)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('academicDepartment', 'name')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks')
    .sort({ date: 1, startTime: 1 });
};



export const countEnrolledStudentsForOfferedSubject = async (offeredSubjectId: string) => {
  return EnrolledSubject.countDocuments({
    offeredSubject: offeredSubjectId,
    isEnrolled: true,
  });
};

type TClassSessionSeedContext = {
  offeredSubject: Pick<
    TClassSession,
    | 'semesterRegistration'
    | 'academicSemester'
    | 'academicDepartment'
    | 'subject'
    | 'instructor'
  > & {
    _id: Types.ObjectId;
    scheduleBlocks?: TScheduleBlock[];
    days?: TDays[];
    startTime?: string;
    endTime?: string;
  };
  semesterRegistration: {
    startDate: Date;
    endDate: Date;
  };
  totalStudents: number;
};

const resolveClassSessionScheduleBlocks = (
  offeredSubject: TClassSessionSeedContext['offeredSubject'],
) => {
  const scheduleBlocks: Array<{
    day: TDays;
    room?: TScheduleBlock['room'];
    classType?: TOfferedSubjectClassType;
    startPeriod?: number;
    periodCount?: number;
    periodNumbers?: number[];
    startTimeSnapshot: string;
    endTimeSnapshot: string;
  }> = offeredSubject.scheduleBlocks?.length
    ? offeredSubject.scheduleBlocks.map((block) => ({
        day: block.day,
        room: block.room,
        classType: block.classType,
        startPeriod: block.startPeriod,
        periodCount: block.periodCount,
        periodNumbers: block.periodNumbers,
        startTimeSnapshot: block.startTimeSnapshot,
        endTimeSnapshot: block.endTimeSnapshot,
      }))
    : (offeredSubject.days ?? []).map((day) => ({
        day,
        startTimeSnapshot: offeredSubject.startTime ?? '',
        endTimeSnapshot: offeredSubject.endTime ?? '',
      }));

  return scheduleBlocks.sort((left, right) => {
    if (left.day !== right.day) {
      return left.day.localeCompare(right.day);
    }

    return (
      timeToMinutes(left.startTimeSnapshot) -
      timeToMinutes(right.startTimeSnapshot)
    );
  });
};

export const buildClassSessionSeedsForRange = (
  context: TClassSessionSeedContext,
  options: {
    rangeStart: Date;
    rangeEnd: Date;
    materializeFrom: Date;
    nextSessionNumber?: number;
  },
) => {
  const semesterStart = normalizeUtcDate(context.semesterRegistration.startDate);
  const semesterEnd = normalizeUtcDate(context.semesterRegistration.endDate);
  const rangeStart = normalizeUtcDate(options.rangeStart);
  const rangeEnd = normalizeUtcDate(options.rangeEnd);
  const materializeFrom = normalizeUtcDate(options.materializeFrom);
  const resolvedScheduleBlocks = resolveClassSessionScheduleBlocks(
    context.offeredSubject,
  );

  if (!resolvedScheduleBlocks.length) {
    return {
      sessions: [] as Array<Partial<TClassSession>>,
      nextSessionNumber: options.nextSessionNumber ?? 1,
    };
  }

  const effectiveStart =
    rangeStart.getTime() < semesterStart.getTime() ? semesterStart : rangeStart;
  const effectiveEnd =
    rangeEnd.getTime() > semesterEnd.getTime() ? semesterEnd : rangeEnd;

  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    return {
      sessions: [] as Array<Partial<TClassSession>>,
      nextSessionNumber: options.nextSessionNumber ?? 1,
    };
  }

  const sessions: Array<Partial<TClassSession>> = [];
  let sessionNumber = options.nextSessionNumber ?? 1;
  let current = new Date(effectiveStart);

  while (current.getTime() <= effectiveEnd.getTime()) {
    const date = normalizeUtcDate(current);
    const day = getUtcDayLabel(date);
    const matchedBlocks = resolvedScheduleBlocks.filter((block) => block.day === day);

    for (const block of matchedBlocks) {
      if (date.getTime() >= materializeFrom.getTime()) {
        sessions.push({
          offeredSubject: context.offeredSubject._id,
          semesterRegistration: context.offeredSubject.semesterRegistration,
          academicSemester: context.offeredSubject.academicSemester,
          academicDepartment: context.offeredSubject.academicDepartment,
          subject: context.offeredSubject.subject,
          instructor: context.offeredSubject.instructor,
          room: block.room,
          classType: block.classType,
          sessionNumber,
          date,
          day,
          startPeriod: block.startPeriod,
          periodCount: block.periodCount,
          periodNumbers: block.periodNumbers ?? [],
          startTime: block.startTimeSnapshot,
          endTime: block.endTimeSnapshot,
          totalStudents: context.totalStudents,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          status: 'SCHEDULED',
        });
      }

      sessionNumber += 1;
    }

    current = new Date(date);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    sessions,
    nextSessionNumber: sessionNumber,
  };
};

export const buildClassSessionSeeds = async (
  offeredSubjectId: string,
): Promise<Array<Partial<TClassSession>>> => {
  const offeredSubject = await OfferedSubject.findById(offeredSubjectId);

  if (!offeredSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found !');
  }

  const semesterRegistration = await SemesterRegistration.findById(
    offeredSubject.semesterRegistration,
  );

  if (!semesterRegistration) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found !',
    );
  }

  const totalStudents = await countEnrolledStudentsForOfferedSubject(
    offeredSubjectId,
  );

  return buildClassSessionSeedsForRange(
    {
      offeredSubject: {
        _id: offeredSubject._id,
        semesterRegistration: offeredSubject.semesterRegistration,
        academicSemester: offeredSubject.academicSemester,
        academicDepartment: offeredSubject.academicDepartment,
        subject: offeredSubject.subject,
        instructor: offeredSubject.instructor,
        scheduleBlocks: offeredSubject.scheduleBlocks,
        days: offeredSubject.days,
        startTime: offeredSubject.startTime,
        endTime: offeredSubject.endTime,
      },
      semesterRegistration: {
        startDate: semesterRegistration.startDate,
        endDate: semesterRegistration.endDate,
      },
      totalStudents,
    },
    {
      rangeStart: semesterRegistration.startDate,
      rangeEnd: semesterRegistration.endDate,
      materializeFrom: semesterRegistration.startDate,
    },
  ).sessions;
};

export const doClockTimesOverlap = (
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) =>
  timeToMinutes(firstStart) < timeToMinutes(secondEnd) &&
  timeToMinutes(firstEnd) > timeToMinutes(secondStart);
