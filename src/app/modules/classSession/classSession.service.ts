import { type ClientSession } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { Curriculum } from '../curriculum/curriculum.model.js';
import { Room } from '../room/room.model.js';
import { PeriodConfigServices } from '../periodConfig/periodConfig.service.js';
import { ClassSession } from './classSession.model.js';
import type {
  TClassSessionRescheduleAvailability,
  TClassSessionRescheduleRoomOption,
  TClassSessionRescheduleSlotOption,
  TCurriculumClassScheduleStatus,
  TFilterOption,
  TPopulatedStudent,
  TSemesterRegistrationOptionSource,
  TSyncClassSessionResult,
} from './classSession.interface.js';
import { StudentAttendance } from '../studentAttendance/studentAttendance.model.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  buildClassSessionSeedsForRange,
  buildUtcMonthRanges,
  buildSemesterRegistrationOption,
  buildSessionFilter,
  buildSessionQuery,
  buildSubjectOption,
  countEnrolledStudentsForOfferedSubject,
  doClockTimesOverlap,
  formatUtcDateKey,
  getTodayUtc,
  getUtcDayLabel,
  isBeforeTodayUtc,
  isSameUtcDate,
  normalizeUtcDate,
  paginate,
  resolveInstructorIdFromUserId,
  resolveStudentIdFromUserId,
} from './classSession.utils.js';

function logRealtimeError(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Realtime notification failed for ${action}: ${detail}\n`);
}

const buildSessionIdentityKey = (payload: {
  date: Date | string;
  startTime?: string;
  room?: { toString(): string } | string | null;
}) =>
  [
    formatUtcDateKey(new Date(payload.date)),
    payload.startTime ?? '',
    typeof payload.room === 'string'
      ? payload.room
      : payload.room?.toString?.() ?? '',
  ].join(':');

const RESYNCABLE_STATUSES = new Set(['SCHEDULED', 'MISSED', 'CANCELLED']);

const getCurriculumForScheduling = async (curriculumId: string) => {
  const curriculum = await Curriculum.findById(curriculumId).select(
    'academicDepartment academicSemester semisterRegistration offeredSubjects',
  );

  if (!curriculum) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found !');
  }

  return curriculum;
};

const getCurriculumScheduleStatusSnapshot = async (
  curriculumId: string,
): Promise<{
  curriculum: Awaited<ReturnType<typeof getCurriculumForScheduling>>;
  registrationStatus: string | null;
  totalOfferedSubjects: number;
  canSchedule: boolean;
  blockingReason: string | null;
}> => {
  const curriculum = await getCurriculumForScheduling(curriculumId);
  const offeredSubjectIds = (curriculum.offeredSubjects || []).map((id: any) =>
    id.toString(),
  );

  if (!offeredSubjectIds.length) {
    return {
      curriculum,
      registrationStatus: null,
      totalOfferedSubjects: 0,
      canSchedule: false,
      blockingReason: 'Classes can not be scheduled because this curriculum has no offered subjects.',
    };
  }

  const semesterRegistration = await SemesterRegistration.findById(
    curriculum.semisterRegistration,
  ).select('status');

  if (!semesterRegistration) {
    return {
      curriculum,
      registrationStatus: null,
      totalOfferedSubjects: offeredSubjectIds.length,
      canSchedule: false,
      blockingReason: 'Classes can not be scheduled because the associated semester registration was not found.',
    };
  }

  if (semesterRegistration.status !== 'ONGOING') {
    return {
      curriculum,
      registrationStatus: semesterRegistration.status,
      totalOfferedSubjects: offeredSubjectIds.length,
      canSchedule: false,
      blockingReason: `Classes can only be scheduled while the semester registration is ONGOING. Current status: ${semesterRegistration.status}.`,
    };
  }

  return {
    curriculum,
    registrationStatus: semesterRegistration.status,
    totalOfferedSubjects: offeredSubjectIds.length,
    canSchedule: true,
    blockingReason: null,
  };
};

const getOfferedSubjectIdsForCurriculum = async (curriculumId: string) => {
  const snapshot = await getCurriculumScheduleStatusSnapshot(curriculumId);

  if (!snapshot.canSchedule) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      snapshot.blockingReason ?? 'Classes can not be scheduled for this curriculum.',
    );
  }

  const offeredSubjectIds = (snapshot.curriculum.offeredSubjects || []).map(
    (id: any) => id.toString(),
  );

  return offeredSubjectIds;
};

const resolveOfferedSubjectSchedulingContext = async (offeredSubjectId: string) => {
  const offeredSubject = await OfferedSubject.findById(offeredSubjectId).select(
    [
      'semesterRegistration',
      'academicSemester',
      'academicDepartment',
      'subject',
      'instructor',
      'scheduleBlocks',
      'days',
      'startTime',
      'endTime',
    ].join(' '),
  );

  if (!offeredSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered subject not found !');
  }

  const curriculum = await Curriculum.findOne({
    semisterRegistration: offeredSubject.semesterRegistration,
    academicSemester: offeredSubject.academicSemester,
    academicDepartment: offeredSubject.academicDepartment,
    offeredSubjects: offeredSubject._id,
  }).select('_id semisterRegistration offeredSubjects');

  if (!curriculum) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Classes can not be scheduled until a matching curriculum is created for this offered subject.',
    );
  }

  const semesterRegistration = await SemesterRegistration.findById(
    offeredSubject.semesterRegistration,
  ).select('status startDate endDate');

  if (!semesterRegistration) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Associated semester registration not found !',
    );
  }

  if (semesterRegistration.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Classes can only be scheduled while the semester registration is ONGOING. Current status: ${semesterRegistration.status}.`,
    );
  }

  return {
    offeredSubject,
    curriculum,
    semesterRegistration,
  };
};

const getDefaultSyncOfferedSubjectIds = async () => {
  const ongoingRegistrationIds = await SemesterRegistration.find({
    status: 'ONGOING',
  }).distinct('_id');

  if (!ongoingRegistrationIds.length) {
    return [] as string[];
  }

  const curricula = await Curriculum.find({
    semisterRegistration: { $in: ongoingRegistrationIds },
  }).select('offeredSubjects');

  return Array.from(
    new Set(
      curricula.flatMap((curriculum) =>
        (curriculum.offeredSubjects || []).map((id: any) => id.toString()),
      ),
    ),
  );
};

const syncSingleOfferedSubjectClassSessionsIntoDB = async (
  offeredSubjectId: string,
  options?: { replaceScheduled?: boolean },
): Promise<TSyncClassSessionResult> => {
  const { offeredSubject, semesterRegistration } =
    await resolveOfferedSubjectSchedulingContext(offeredSubjectId);
  const totalStudents = await countEnrolledStudentsForOfferedSubject(
    offeredSubjectId,
  );
  const today = getTodayUtc();
  const monthlyRanges = buildUtcMonthRanges(
    semesterRegistration.startDate,
    semesterRegistration.endDate,
  );

  if (options?.replaceScheduled) {
    await ClassSession.deleteMany({
      offeredSubject: offeredSubjectId,
      status: { $in: Array.from(RESYNCABLE_STATUSES) },
      date: { $gte: today },
    });
  }

  let nextSessionNumber = 1;
  let generatedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let processedMonths = 0;

  for (const monthlyRange of monthlyRanges) {
    const monthSeeds = buildClassSessionSeedsForRange(
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
        rangeStart: monthlyRange.start,
        rangeEnd: monthlyRange.end,
        materializeFrom: today,
        nextSessionNumber,
      },
    );
    nextSessionNumber = monthSeeds.nextSessionNumber;

    if (!monthSeeds.sessions.length) {
      continue;
    }

    processedMonths += 1;

    const existingSessions = await ClassSession.find({
      offeredSubject: offeredSubjectId,
      date: {
        $gte: monthlyRange.start,
        $lte: monthlyRange.end,
      },
    }).select('_id date status startTime room');

    const existingDateKeys = new Set(
      existingSessions.map((item) => buildSessionIdentityKey(item)),
    );
    const existingSessionMap = new Map(
      existingSessions.map((item) => [buildSessionIdentityKey(item), item]),
    );

    const missingSessions = monthSeeds.sessions.filter((session) => {
      return !existingDateKeys.has(
        buildSessionIdentityKey(
          session as { date: Date; startTime?: string; room?: string },
        ),
      );
    });

    if (missingSessions.length) {
      await ClassSession.insertMany(missingSessions, { ordered: false });
      generatedCount += missingSessions.length;
    }

    const updates = monthSeeds.sessions
      .map((session) => {
        const existing = existingSessionMap.get(
          buildSessionIdentityKey(
            session as { date: Date; startTime?: string; room?: string },
          ),
        );

        if (!existing || !RESYNCABLE_STATUSES.has(existing.status)) {
          return null;
        }

        return {
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                semesterRegistration: session.semesterRegistration,
                academicSemester: session.academicSemester,
                academicDepartment: session.academicDepartment,
                subject: session.subject,
                instructor: session.instructor,
                room: session.room,
                classType: session.classType,
                sessionNumber: session.sessionNumber,
                day: session.day,
                startPeriod: session.startPeriod,
                periodCount: session.periodCount,
                periodNumbers: session.periodNumbers,
                startTime: session.startTime,
                endTime: session.endTime,
                totalStudents: session.totalStudents,
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (updates.length) {
      await ClassSession.bulkWrite(
        updates as Parameters<typeof ClassSession.bulkWrite>[0],
        {
          ordered: false,
        },
      );
      updatedCount += updates.length;
    }

    skippedCount += Math.max(
      monthSeeds.sessions.length - missingSessions.length - updates.length,
      0,
    );
  }

  return {
    offeredSubjectId,
    generatedCount,
    updatedCount,
    skippedCount,
    totalStudents,
    processedMonths,
  };
};

const syncClassSessionsIntoDB = async (payload: {
  offeredSubjectId?: string;
  curriculumId?: string;
  replaceScheduled?: boolean;
}) => {
  let offeredSubjectIds: string[] = [];

  if (payload.offeredSubjectId) {
    await resolveOfferedSubjectSchedulingContext(payload.offeredSubjectId);
    offeredSubjectIds = [payload.offeredSubjectId];
  } else if (payload.curriculumId) {
    offeredSubjectIds = await getOfferedSubjectIdsForCurriculum(payload.curriculumId);
  } else {
    offeredSubjectIds = await getDefaultSyncOfferedSubjectIds();
  }

  const result: TSyncClassSessionResult[] = [];

  for (const offeredSubjectId of offeredSubjectIds) {
    result.push(
      await syncSingleOfferedSubjectClassSessionsIntoDB(offeredSubjectId, {
        replaceScheduled: payload.replaceScheduled,
      }),
    );
  }

  return {
    totalOfferedSubjects: offeredSubjectIds.length,
    result,
  };
};

const getCurriculumClassScheduleStatusFromDB = async (curriculumId: string) => {
  const snapshot = await getCurriculumScheduleStatusSnapshot(curriculumId);
  const offeredSubjectIds = (snapshot.curriculum.offeredSubjects || []).map(
    (id: any) => id.toString(),
  );

  if (!offeredSubjectIds.length) {
    return {
      hasSessions: false,
      totalSessions: 0,
      totalOfferedSubjects: 0,
      canSchedule: snapshot.canSchedule,
      registrationStatus: snapshot.registrationStatus,
      blockingReason: snapshot.blockingReason,
    } satisfies TCurriculumClassScheduleStatus;
  }

  const totalSessions = await ClassSession.countDocuments({
    offeredSubject: { $in: offeredSubjectIds },
  });

  return {
    hasSessions: totalSessions > 0,
    totalSessions,
    totalOfferedSubjects: offeredSubjectIds.length,
    canSchedule: snapshot.canSchedule,
    registrationStatus: snapshot.registrationStatus,
    blockingReason: snapshot.blockingReason,
  } satisfies TCurriculumClassScheduleStatus;
};

const getAllClassSessionsFromDB = async (query: Record<string, unknown>) => {
  const { page, limit, skip } = paginate(query);
  const filter = await buildSessionFilter(query);

  const [result, total] = await Promise.all([
    buildSessionQuery(filter).skip(skip).limit(limit),
    ClassSession.countDocuments(filter),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.max(Math.ceil(total / limit), 1),
    },
    result,
  };
};

const getInstructorClassSessionsFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { page, limit, skip } = paginate(query);
  const instructorId = await resolveInstructorIdFromUserId(userId);
  const filter = await buildSessionFilter(query);
  filter.instructor = instructorId;
  const [result, total] = await Promise.all([
    buildSessionQuery(filter).skip(skip).limit(limit),
    ClassSession.countDocuments(filter),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.max(Math.ceil(total / limit), 1),
    },
    result,
  };
};

const getStudentClassSessionsFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const { page, limit, skip } = paginate(query);
  const studentId = await resolveStudentIdFromUserId(userId);
  const enrolledSubjects = await EnrolledSubject.find({
    student: studentId,
    isEnrolled: true,
  }).select('offeredSubject');

  const offeredSubjectIds = enrolledSubjects.map((item) => item.offeredSubject);
  const filter = await buildSessionFilter(query);
  filter.offeredSubject = { $in: offeredSubjectIds };

  const [result, total] = await Promise.all([
    buildSessionQuery(filter).skip(skip).limit(limit).lean(),
    ClassSession.countDocuments(filter),
  ]);

  const attendanceRows = await StudentAttendance.find({
    classSession: { $in: result.map((item) => item._id) },
    student: studentId,
  })
    .select('classSession status markedAt remarks')
    .lean();

  const attendanceBySessionId = new Map(
    attendanceRows.map((item) => [item.classSession.toString(), item]),
  );

  const mappedResult = result.map((item) => ({
    ...item,
    myAttendance: attendanceBySessionId.get(item._id.toString()) ?? null,
  }));

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.max(Math.ceil(total / limit), 1),
    },
    result: mappedResult,
  };
};

const assertInstructorOwnsClassSession = async (
  classSessionId: string,
  userId: string,
) => {
  const instructorId = await resolveInstructorIdFromUserId(userId);
  const classSession = await ClassSession.findOne({
    _id: classSessionId,
    instructor: instructorId,
  });

  if (!classSession) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden !');
  }

  return classSession;
};

const getInstructorClassSessionDetailsFromDB = async (
  classSessionId: string,
  userId: string,
) => {
  const classSession = await assertInstructorOwnsClassSession(
    classSessionId,
    userId,
  );

  const [populatedClassSession, enrolledSubjects, attendanceRows] =
    await Promise.all([
      ClassSession.findById(classSession._id)
        .populate('subject', 'title code')
        .populate('instructor', 'id name designation')
        .populate('room', 'roomName roomNumber buildingNumber capacity')
        .populate('offeredSubject', 'days startTime endTime scheduleBlocks')
        .populate('semesterRegistration', 'status shift startDate endDate'),
      EnrolledSubject.find({
        offeredSubject: classSession.offeredSubject,
        isEnrolled: true,
      })
        .populate('student', 'id name email contactNo')
        .select('student'),
      StudentAttendance.find({
        classSession: classSession._id,
      }).select('student status remarks markedAt'),
    ]);

  const attendanceMap = new Map(
    attendanceRows.map((item) => [item.student.toString(), item]),
  );

  const students = enrolledSubjects
    .map((item) => {
      const student = item.student as unknown as TPopulatedStudent | null;
      const attendance = student
        ? attendanceMap.get(student._id.toString())
        : undefined;

      if (!student) {
        return null;
      }

      return {
        studentId: student._id,
        studentCode: student.id,
        name: student.name,
        email: student.email,
        contactNo: student.contactNo,
        attendanceStatus: attendance?.status ?? 'NOT_MARKED',
        remarks: attendance?.remarks ?? null,
        markedAt: attendance?.markedAt ?? null,
      };
    })
    .filter(Boolean)
    .sort((first, second) =>
      String(first?.studentCode ?? '').localeCompare(
        String(second?.studentCode ?? ''),
      ),
    );

  return {
    classSession: populatedClassSession,
    students,
  };
};

const assertClassSessionHasNotStarted = (classSession: {
  status: string;
  startedAt?: Date | null;
}) => {
  if (classSession.startedAt || ['ONGOING', 'COMPLETED'].includes(classSession.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `This class can no longer be changed because it has already ${classSession.status === 'COMPLETED' ? 'been completed' : 'started'}.`,
    );
  }
};

const assertClassSessionCanStartToday = (classSession: {
  date: Date;
  status: string;
}) => {
  const today = getTodayUtc();

  if (!isSameUtcDate(classSession.date, today)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Class can only be started on its scheduled date (${formatUtcDateKey(classSession.date)}).`,
    );
  }
};

const getClassSessionRequiredPeriodCount = (classSession: {
  periodCount?: number;
  periodNumbers?: number[];
}) => {
  if (classSession.periodNumbers?.length) {
    return classSession.periodNumbers.length;
  }

  if (
    typeof classSession.periodCount === 'number' &&
    Number.isFinite(classSession.periodCount) &&
    classSession.periodCount > 0
  ) {
    return classSession.periodCount;
  }

  return 1;
};

const buildContiguousPeriodCandidates = (
  periods: Array<{
    periodNo: number;
    title?: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }>,
  desiredCount: number,
) => {
  const options: Array<{
    startPeriod: number;
    periodCount: number;
    periodNumbers: number[];
    startTime: string;
    endTime: string;
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
      startTime: selected[0].startTime,
      endTime: selected[selected.length - 1].endTime,
    });
  }

  return options;
};

const doPeriodNumbersOverlap = (left: number[], right: number[]) => {
  const rightSet = new Set(right);
  return left.some((periodNo) => rightSet.has(periodNo));
};

const doesClassSessionOverlapCandidate = (
  classSession: {
    startTime: string;
    endTime: string;
    periodNumbers?: number[];
    startPeriod?: number;
    periodCount?: number;
  },
  candidate: {
    startTime: string;
    endTime: string;
    periodNumbers: number[];
  },
) => {
  const existingPeriods =
    classSession.periodNumbers?.length
      ? classSession.periodNumbers
      : typeof classSession.startPeriod === 'number' &&
          typeof classSession.periodCount === 'number'
        ? Array.from(
            { length: classSession.periodCount },
            (_, index) => classSession.startPeriod! + index,
          )
        : [];

  if (existingPeriods.length && candidate.periodNumbers.length) {
    return doPeriodNumbersOverlap(existingPeriods, candidate.periodNumbers);
  }

  return doClockTimesOverlap(
    classSession.startTime,
    classSession.endTime,
    candidate.startTime,
    candidate.endTime,
  );
};

const isRoomEligibleForClassSession = (
  room: TClassSessionRescheduleRoomOption,
  classType?: string,
) => {
  if (classType === 'practical') {
    return room.roomType === 'practical' || room.roomType === 'both';
  }

  return true;
};

/**
 * Validation: Get curriculum for a given offered subject
 * Needed to check curriculum-level conflicts
 */
const getCurriculumByOfferedSubject = async (offeredSubjectId: string) => {
  const curriculum = await Curriculum.findOne({
    offeredSubjects: offeredSubjectId,
  }).select('_id');

  return curriculum?._id.toString() ?? null;
};

/**
 * Validation: Check if curriculum already has another class at the same date/time
 * Rule: Students of same curriculum cannot attend multiple classes simultaneously
 */
const validateCurriculumConflictOnDate = async (
  offeredSubjectId: string,
  targetDate: Date,
  curriculumId: string | null,
  currentClassSessionId: string,
) => {
  if (!curriculumId) {
    return { hasConflict: false, conflictingSubjects: [] as string[] };
  }

  // Get all offered subjects in this curriculum
  const curriculum = await Curriculum.findById(curriculumId).select('offeredSubjects');
  if (!curriculum) {
    return { hasConflict: false, conflictingSubjects: [] as string[] };
  }

  const curriculumSubjectIds = (curriculum.offeredSubjects || []).map((id: any) =>
    id.toString(),
  );

  // Find all classes for curriculum subjects on target date (excluding current class and cancelled classes)
  const conflictingSessions = await ClassSession.find({
    offeredSubject: { $in: curriculumSubjectIds },
    _id: { $ne: currentClassSessionId },
    date: targetDate,
    status: { $ne: 'CANCELLED' },
  })
    .select('offeredSubject startTime endTime startPeriod periodCount periodNumbers subject')
    .populate('subject', 'title code');

  if (!conflictingSessions.length) {
    return { hasConflict: false, conflictingSubjects: [] };
  }

  // Collect unique subject names of conflicting classes
  const conflictingSubjects = Array.from(
    new Set(
      conflictingSessions
        .map((session) => {
          const subject = session.subject as any;
          return subject?.title ?? 'Unknown Subject';
        })
        .filter(Boolean),
    ),
  );

  return {
    hasConflict: true,
    conflictingSubjects,
  };
};

/**
 * Validation: Check if same subject already scheduled on target date
 * Rule: Avoid duplicate same-subject schedule on same date
 */
const validateSameSubjectDuplicateOnDate = async (
  offeredSubjectId: string,
  targetDate: Date,
  currentClassSessionId: string,
) => {
  const existingSession = await ClassSession.findOne({
    offeredSubject: offeredSubjectId,
    _id: { $ne: currentClassSessionId },
    date: targetDate,
    status: { $ne: 'CANCELLED' },
  }).select('subject');

  return {
    hasDuplicate: !!existingSession,
    message: existingSession
      ? 'This subject already has another class scheduled on this date. Rescheduling would create duplicate classes.'
      : null,
  };
};

/**
 * Validation: Get next scheduled class date for the same subject
 * Rule: Can reschedule only before next scheduled class of same subject
 */
const getNextSubjectClassDate = async (
  offeredSubjectId: string,
  currentDate: Date,
  currentClassSessionId: string,
) => {
  const nextSession = await ClassSession.findOne({
    offeredSubject: offeredSubjectId,
    _id: { $ne: currentClassSessionId },
    date: { $gt: currentDate },
    status: { $ne: 'CANCELLED' },
  })
    .select('date')
    .sort({ date: 1 });

  return nextSession ? new Date(nextSession.date) : null;
};

/**
 * Validation: Check if reschedule maintains chronological sequence
 * Rule: Can reschedule only before next scheduled class
 */
const validateChronologicalSequence = async (
  offeredSubjectId: string,
  currentClassDate: Date,
  targetDate: Date,
  currentClassSessionId: string,
) => {
  const nextClassDate = await getNextSubjectClassDate(
    offeredSubjectId,
    currentClassDate,
    currentClassSessionId,
  );

  if (!nextClassDate) {
    // No next class exists, reschedule is allowed
    return { isValid: true, reason: null, nextClassDate: null };
  }

  if (targetDate >= nextClassDate) {
    return {
      isValid: false,
      reason: `Cannot reschedule to or after the next scheduled class date (${formatUtcDateKey(
        nextClassDate,
      )}). Maintain chronological academic sequence.`,
      nextClassDate,
    };
  }

  return { isValid: true, reason: null, nextClassDate };
};

/**
 * Build detailed availability with ALL conflict validations
 */
const buildDetailedSlotValidation = (
  candidate: {
    startPeriod: number;
    periodCount: number;
    periodNumbers: number[];
    startTime: string;
    endTime: string;
  },
  existingSessions: Array<{
    _id: any;
    instructor: any;
    room?: any;
    startTime: string;
    endTime: string;
    startPeriod?: number;
    periodCount?: number;
    periodNumbers?: number[];
  }>,
  classSession: any,
  eligibleRooms: TClassSessionRescheduleRoomOption[],
  hasCurriculumConflict: boolean,
  curriculumConflictSubjects: string[],
) => {
  const overlappingSessions = existingSessions.filter((existingSession) =>
    doesClassSessionOverlapCandidate(existingSession, candidate),
  );

  const instructorConflict = overlappingSessions.find(
    (existingSession) =>
      existingSession.instructor.toString() ===
      classSession.instructor.toString(),
  );

  const availableRooms = eligibleRooms.filter((room) => {
    return !overlappingSessions.some((existingSession) => {
      const existingRoomId =
        typeof existingSession.room === 'string'
          ? existingSession.room
          : existingSession.room?.toString?.();

      return existingRoomId === room._id;
    });
  });

  const isCurrentRoomAvailable = classSession.room
    ? availableRooms.some(
        (room) => room._id === classSession.room?.toString(),
      )
    : false;

  const isInstructorAvailable = !instructorConflict;
  const isRoomAvailable = availableRooms.length > 0;

  // Slot is valid ONLY if all validations pass
  const isValid =
    isInstructorAvailable &&
    isRoomAvailable &&
    !hasCurriculumConflict;

  let blockingReason: string | null = null;
  if (!isInstructorAvailable) {
    blockingReason = 'Instructor already has another class during these periods.';
  } else if (!isRoomAvailable) {
    blockingReason = 'No eligible rooms are free during these periods.';
  } else if (hasCurriculumConflict) {
    blockingReason = `Students already have another class during these periods (${curriculumConflictSubjects.join(
      ', ',
    )}). Cannot attend multiple classes simultaneously.`;
  }

  return {
    startPeriod: candidate.startPeriod,
    periodCount: candidate.periodCount,
    periodNumbers: candidate.periodNumbers,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    isInstructorAvailable,
    instructorConflictMessage: isInstructorAvailable
      ? null
      : 'Instructor already has another class during these periods.',
    availableRooms,
    isCurrentRoomAvailable,
    isValid,
    blockingReason,
    curriculumConflict: hasCurriculumConflict
      ? {
          hasConflict: true,
          conflictingSubjects: curriculumConflictSubjects,
          message: `Students already have another class during these periods: ${curriculumConflictSubjects.join(
            ', ',
          )}`,
        }
      : null,
  };
};

const resolveClassSessionRescheduleContext = async (classSessionId: string) => {
  const classSession = await ClassSession.findById(classSessionId).select(
    [
      'semesterRegistration',
      'instructor',
      'room',
      'classType',
      'periodCount',
      'periodNumbers',
      'startPeriod',
      'totalStudents',
      'status',
      'startedAt',
      'date',
      'offeredSubject',
      'subject',
    ].join(' '),
  );

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  assertClassSessionHasNotStarted(classSession);

  const semesterRegistration = await SemesterRegistration.findById(
    classSession.semesterRegistration,
  ).select('status shift');

  if (!semesterRegistration) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Associated semester registration not found !',
    );
  }

  if (semesterRegistration.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Classes can only be rescheduled while the semester registration is ONGOING. Current status: ${semesterRegistration.status}.`,
    );
  }

  const activePeriodConfig = await PeriodConfigServices.getActivePeriodConfigFromDB(
    semesterRegistration.shift,
    classSession.semesterRegistration.toString(),
  );

  const periods = [...(activePeriodConfig.periods ?? [])]
    .filter((period) => period.isActive !== false && period.isBreak !== true)
    .sort((left, right) => left.periodNo - right.periodNo)
    .map((period) => ({
      periodNo: period.periodNo,
      title: period.title,
      startTime: period.startTime,
      endTime: period.endTime,
      durationMinutes: period.durationMinutes,
    }));

  if (!periods.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No schedulable periods were found in the active period configuration.',
    );
  }

  const minimumCapacity = Math.max(classSession.totalStudents ?? 0, 1);
  const eligibleRooms = (
    await Room.find({
      isActive: { $ne: false },
      capacity: { $gte: minimumCapacity },
    }).select(
      'roomName roomNumber buildingNumber capacity roomType',
    )
  )
    .map((room) => ({
      _id: room._id.toString(),
      roomName: room.roomName,
      roomNumber: room.roomNumber,
      buildingNumber: room.buildingNumber,
      capacity: room.capacity,
      roomType: room.roomType,
    }))
    .filter((room) =>
      isRoomEligibleForClassSession(room, classSession.classType),
    )
    .sort((left, right) => {
      if (left.buildingNumber !== right.buildingNumber) {
        return left.buildingNumber - right.buildingNumber;
      }

      if (left.roomNumber !== right.roomNumber) {
        return left.roomNumber - right.roomNumber;
      }

      return left.roomName.localeCompare(right.roomName);
    });

  // Get curriculum ID for conflict validation
  const curriculumId = await getCurriculumByOfferedSubject(
    classSession.offeredSubject.toString(),
  );

  return {
    classSession,
    semesterRegistration,
    periods,
    eligibleRooms,
    requiredPeriodCount: getClassSessionRequiredPeriodCount(classSession),
    curriculumId,
  };
};

const buildClassSessionRescheduleAvailability = async (
  classSessionId: string,
  requestedDate: string,
): Promise<TClassSessionRescheduleAvailability> => {
  if (!requestedDate.trim()) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'A reschedule date is required.');
  }

  const nextDate = normalizeUtcDate(requestedDate);

  if (Number.isNaN(nextDate.getTime())) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid reschedule date.');
  }

  if (isBeforeTodayUtc(nextDate)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Classes can not be rescheduled to a past date.',
    );
  }

  const context = await resolveClassSessionRescheduleContext(classSessionId);
  const day = getUtcDayLabel(nextDate);
  const slotCandidates = buildContiguousPeriodCandidates(
    context.periods,
    context.requiredPeriodCount,
  );

  const existingSessions = await ClassSession.find({
    _id: { $ne: classSessionId },
    date: nextDate,
    status: { $ne: 'CANCELLED' },
  }).select('instructor room startTime endTime startPeriod periodCount periodNumbers');

  // ============ NEW VALIDATIONS ============

  // Validation 1: Check same subject duplicate scheduling
  const { hasDuplicate: hasSameSubjectDuplicate, message: duplicateMessage } =
    await validateSameSubjectDuplicateOnDate(
      context.classSession.offeredSubject.toString(),
      nextDate,
      classSessionId,
    );

  // Validation 2: Check curriculum conflicts
  const { hasConflict: hasCurriculumConflict, conflictingSubjects: curriculumConflictSubjects } =
    await validateCurriculumConflictOnDate(
      context.classSession.offeredSubject.toString(),
      nextDate,
      context.curriculumId,
      classSessionId,
    );

  // Validation 3: Check chronological sequence
  const chronoSequenceCheck = await validateChronologicalSequence(
    context.classSession.offeredSubject.toString(),
    context.classSession.date,
    nextDate,
    classSessionId,
  );

  // Build slots with comprehensive validation
  const slots: TClassSessionRescheduleSlotOption[] = slotCandidates.map((candidate) =>
    buildDetailedSlotValidation(
      candidate,
      existingSessions,
      context.classSession,
      context.eligibleRooms,
      hasCurriculumConflict,
      curriculumConflictSubjects,
    ),
  );

  return {
    classSessionId,
    date: formatUtcDateKey(nextDate),
    day,
    shift: context.semesterRegistration.shift,
    classType: context.classSession.classType,
    requiredPeriodCount: context.requiredPeriodCount,
    totalStudents: context.classSession.totalStudents ?? 0,
    currentRoomId: context.classSession.room?.toString() ?? null,
    currentStartPeriod:
      typeof context.classSession.startPeriod === 'number'
        ? context.classSession.startPeriod
        : null,
    currentPeriodNumbers: context.classSession.periodNumbers ?? [],
    periods: context.periods,
    slots,
    // New validation information
    validationInfo: {
      hasSameSubjectDuplicate,
      duplicateMessage,
      hasCurriculumConflict,
      curriculumConflictSubjects,
      chronoSequenceCheck: {
        isValid: chronoSequenceCheck.isValid,
        reason: chronoSequenceCheck.reason,
        nextClassDate: chronoSequenceCheck.nextClassDate
          ? formatUtcDateKey(chronoSequenceCheck.nextClassDate)
          : null,
      },
    },
  };
};

const getClassSessionRescheduleAvailabilityFromDB = async (
  classSessionId: string,
  requestedDate: string,
) => {
  return buildClassSessionRescheduleAvailability(classSessionId, requestedDate);
};

const startClassSessionIntoDB = async (
  classSessionId: string,
  userId: string,
  payload: { topic?: string; remarks?: string },
) => {
  const classSession = await assertInstructorOwnsClassSession(
    classSessionId,
    userId,
  );

  if (classSession.status !== 'SCHEDULED') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Class can not be started because it is already ${classSession.status}`,
    );
  }

  assertClassSessionCanStartToday(classSession);

  const totalStudents = await countEnrolledStudentsForOfferedSubject(
    classSession.offeredSubject.toString(),
  );

  const result = await ClassSession.findByIdAndUpdate(
    classSessionId,
    {
      ...payload,
      totalStudents,
      status: 'ONGOING',
      startedAt: new Date(),
      instructorCheckInTime: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks');

  if (result) {
    void NotificationService.notifyClassStarted(result).catch((error) =>
      logRealtimeError('class start', error),
    );
  }

  return result;
};

const completeClassSessionIntoDB = async (
  classSessionId: string,
  userId: string,
) => {
  const classSession = await assertInstructorOwnsClassSession(
    classSessionId,
    userId,
  );

  if (classSession.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Class can not be completed because it is ${classSession.status}`,
    );
  }

  const totalEnrolledStudents = await EnrolledSubject.countDocuments({
    offeredSubject: classSession.offeredSubject,
    isEnrolled: true,
  });
  const totalMarkedAttendance = await StudentAttendance.countDocuments({
    classSession: classSession._id,
  });

  if (totalMarkedAttendance !== totalEnrolledStudents) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Attendance must be submitted for all enrolled students before completing the class.',
    );
  }

  const result = await ClassSession.findByIdAndUpdate(
    classSessionId,
    {
      status: 'COMPLETED',
      completedAt: new Date(),
      instructorCheckOutTime: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks');

  if (result) {
    void NotificationService.notifyClassCompleted(result).catch((error) =>
      logRealtimeError('class completion', error),
    );
  }

  return result;
};

const rescheduleClassSessionIntoDB = async (
  classSessionId: string,
  payload: {
    date: string;
    startPeriod: number;
    room: string;
  },
) => {
  const availability = await buildClassSessionRescheduleAvailability(
    classSessionId,
    payload.date,
  );
  
  const selectedSlot = availability.slots.find(
    (slot) => slot.startPeriod === payload.startPeriod,
  );

  if (!selectedSlot) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Selected period is not available for this class reschedule.',
    );
  }

  if (!selectedSlot.isValid) {
    throw new AppError(
      StatusCodes.CONFLICT,
      selectedSlot.blockingReason ?? 'Selected period is blocked.',
    );
  }

  const selectedRoom = selectedSlot.availableRooms.find(
    (room) => room._id === payload.room,
  );

  if (!selectedRoom) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Selected room is not available for the chosen period.',
    );
  }

  // ============ FINAL VALIDATIONS BEFORE RESCHEDULE ============

  // Validate 1: Check for same-subject duplicate scheduling
  if (availability.validationInfo.hasSameSubjectDuplicate) {
    throw new AppError(
      StatusCodes.CONFLICT,
      availability.validationInfo.duplicateMessage ??
        'Subject already has another class on this date.',
    );
  }

  // Validate 2: Check for curriculum conflicts
  if (availability.validationInfo.hasCurriculumConflict) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `Cannot reschedule: Students already have another class during these periods (${availability.validationInfo.curriculumConflictSubjects.join(
        ', ',
      )}). Students cannot attend multiple classes simultaneously.`,
    );
  }

  // Validate 3: Check chronological sequence
  if (!availability.validationInfo.chronoSequenceCheck.isValid) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      availability.validationInfo.chronoSequenceCheck.reason ??
        'Reschedule violates chronological academic sequence.',
    );
  }

  const nextDate = normalizeUtcDate(availability.date);

  const result = await ClassSession.findByIdAndUpdate(
    classSessionId,
    {
      date: nextDate,
      day: getUtcDayLabel(nextDate),
      room: payload.room,
      startPeriod: selectedSlot.startPeriod,
      periodCount: selectedSlot.periodCount,
      periodNumbers: selectedSlot.periodNumbers,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      status: 'SCHEDULED',
      cancelledAt: undefined,
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks');

  return result;
};

const cancelClassSessionIntoDB = async (classSessionId: string) => {
  const classSession = await ClassSession.findById(classSessionId);

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  if (classSession.status === 'CANCELLED') {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Class is already cancelled.');
  }

  assertClassSessionHasNotStarted(classSession);

  const result = await ClassSession.findByIdAndUpdate(
    classSessionId,
    {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks');

  return result;
};

const getStudentClassSessionDetailsFromDB = async (
  classSessionId: string,
  userId: string,
) => {
  const studentId = await resolveStudentIdFromUserId(userId);

  const classSession = await ClassSession.findById(classSessionId)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation email')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks')
    .populate('semesterRegistration', 'status shift startDate endDate');

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  const isStudentEnrolled = await EnrolledSubject.findOne({
    student: studentId,
    offeredSubject: classSession.offeredSubject,
    isEnrolled: true,
  }).select('_id');

  if (!isStudentEnrolled) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden !');
  }

  const myAttendance = await StudentAttendance.findOne({
    classSession: classSessionId,
    student: studentId,
  }).select('status remarks markedAt');

  return {
    classSession,
    myAttendance,
    canViewDetails: true,
  };
};

const buildClassSessionStatistics = (classSession: {
  totalStudents?: number;
  presentCount?: number;
  absentCount?: number;
  leaveCount?: number;
}) => {
  const totalStudents = classSession.totalStudents ?? 0;
  const presentCount = classSession.presentCount ?? 0;
  const absentCount = classSession.absentCount ?? 0;
  const leaveCount = classSession.leaveCount ?? 0;

  return {
    totalStudents,
    presentCount,
    absentCount,
    leaveCount,
    notMarkedCount: Math.max(
      totalStudents - presentCount - absentCount - leaveCount,
      0,
    ),
  };
};

const getSingleClassSessionFromDB = async (
  classSessionId: string,
  options?: { includeAttendance?: boolean },
) => {
  const classSession = await ClassSession.findById(classSessionId)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation email')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'days startTime endTime scheduleBlocks')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('academicDepartment', 'name');

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  const statistics = buildClassSessionStatistics(classSession);

  if (options?.includeAttendance === false) {
    return {
      classSession,
      attendance: [],
      statistics,
    };
  }

  const attendance = await StudentAttendance.find({
    classSession: classSessionId,
  })
    .populate('student', 'id name email contactNo')
    .sort({ createdAt: 1 });

  const enrolledStudents = await EnrolledSubject.find({
    offeredSubject: classSession.offeredSubject,
    isEnrolled: true,
  })
    .populate('student', 'id name email contactNo')
    .select('student');

  const attendanceMap = new Map(
    attendance.map((item) => {
      const studentValue =
        typeof item.student === 'string'
          ? item.student
          : (item.student as unknown as TPopulatedStudent)._id.toString();

      return [studentValue, item];
    }),
  );

  const participants = enrolledStudents.map((item) => {
    const student = item.student as unknown as TPopulatedStudent | null;
    const attendanceRow = student
      ? attendanceMap.get(student._id.toString())
      : undefined;

    return {
      _id: attendanceRow?._id?.toString() ?? `${student?._id.toString()}-pending`,
      status: attendanceRow?.status ?? 'NOT_MARKED',
      remarks: attendanceRow?.remarks ?? null,
      markedAt: attendanceRow?.markedAt ?? null,
      student: student
        ? {
            _id: student._id.toString(),
            id: student.id,
            name: student.name,
            email: student.email,
            contactNo: student.contactNo,
          }
        : '',
    };
  });

  return {
    classSession,
    attendance: participants,
    statistics,
  };
};

const getRoleDashboardSummaryFromDB = async (
  userId: string,
  role: string,
) => {
  const today = normalizeUtcDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (role === 'instructor') {
    const instructorId = await resolveInstructorIdFromUserId(userId);
    const sessions = await ClassSession.find({
      instructor: instructorId,
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    }).select('status date startTime endTime');

    return {
      totalToday: sessions.length,
      scheduled: sessions.filter((item) => item.status === 'SCHEDULED').length,
      ongoing: sessions.filter((item) => item.status === 'ONGOING').length,
      completed: sessions.filter((item) => item.status === 'COMPLETED').length,
      sessions,
    };
  }

  if (role === 'student') {
    const studentId = await resolveStudentIdFromUserId(userId);
    const enrolledSubjects = await EnrolledSubject.find({
      student: studentId,
      isEnrolled: true,
    }).select('offeredSubject');

    const sessions = await ClassSession.find({
      offeredSubject: { $in: enrolledSubjects.map((item) => item.offeredSubject) },
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate('subject', 'title code')
      .populate('instructor', 'id name designation')
      .populate('room', 'roomName roomNumber buildingNumber capacity')
      .sort({ startTime: 1 });

    return {
      totalToday: sessions.length,
      scheduled: sessions.filter((item) => item.status === 'SCHEDULED').length,
      ongoing: sessions.filter((item) => item.status === 'ONGOING').length,
      completed: sessions.filter((item) => item.status === 'COMPLETED').length,
      sessions,
    };
  }

  const sessions = await ClassSession.find({
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  })
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('academicDepartment', 'name')
    .sort({ startTime: 1 });

  return {
    totalToday: sessions.length,
    scheduled: sessions.filter((item) => item.status === 'SCHEDULED').length,
    ongoing: sessions.filter((item) => item.status === 'ONGOING').length,
    completed: sessions.filter((item) => item.status === 'COMPLETED').length,
    cancelled: sessions.filter((item) => item.status === 'CANCELLED').length,
    sessions,
  };
};

const getClassSessionFilterOptionsFromDB = async (
  userId: string,
  role: string,
  query: Record<string, unknown>,
) => {
  let semesterRegistrationIds: string[] = [];
  let subjectIds: string[] = [];
  let instructorId: string | null = null;
  let studentId: string | null = null;

  if (role === 'instructor') {
    instructorId = (await resolveInstructorIdFromUserId(userId)).toString();
    semesterRegistrationIds = (
      await OfferedSubject.distinct('semesterRegistration', {
        instructor: instructorId,
      })
    ).map((item) => item.toString());
  } else if (role === 'student') {
    studentId = (await resolveStudentIdFromUserId(userId)).toString();
    semesterRegistrationIds = (
      await EnrolledSubject.distinct('semesterRegistration', {
        student: studentId,
        isEnrolled: true,
      })
    ).map((item) => item.toString());
  } else {
    semesterRegistrationIds = (
      await OfferedSubject.distinct('semesterRegistration')
    ).map((item) => item.toString());
  }

  const semesters = (
    await SemesterRegistration.find({
      _id: { $in: semesterRegistrationIds },
    })
      .populate('academicSemester', 'name year')
      .sort({ startDate: -1, createdAt: -1 })
  )
    .map((item) =>
      buildSemesterRegistrationOption(
        item as unknown as TSemesterRegistrationOptionSource,
      ),
    )
    .filter(Boolean) as TFilterOption[];

  if (typeof query.semesterRegistration === 'string' && query.semesterRegistration.trim()) {
    const semesterRegistration = query.semesterRegistration.trim();

    if (role === 'instructor' && instructorId) {
      subjectIds = (
        await OfferedSubject.distinct('subject', {
          semesterRegistration,
          instructor: instructorId,
        })
      ).map((item) => item.toString());
    } else if (role === 'student' && studentId) {
      subjectIds = (
        await EnrolledSubject.distinct('subject', {
          semesterRegistration,
          student: studentId,
          isEnrolled: true,
        })
      ).map((item) => item.toString());
    } else {
      subjectIds = (
        await OfferedSubject.distinct('subject', {
          semesterRegistration,
        })
      ).map((item) => item.toString());
    }
  }

  const subjects = (
    await Subject.find({
      _id: { $in: subjectIds },
      isDeleted: { $ne: true },
    })
      .select('title code')
      .sort({ title: 1 })
  )
    .map((item) => buildSubjectOption(item))
    .filter(Boolean) as TFilterOption[];

  return {
    semesters,
    subjects,
  };
};

const recalculateClassSessionAttendanceCounts = async (
  classSessionId: string,
  session?: ClientSession,
) => {
  const attendanceRows = await StudentAttendance.find({
    classSession: classSessionId,
  })
    .select('status')
    .session(session ?? null);

  const stats = {
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
  };

  for (const item of attendanceRows) {
    if (item.status === 'PRESENT') {
      stats.presentCount += 1;
    }
    if (item.status === 'ABSENT') {
      stats.absentCount += 1;
    }
    if (item.status === 'LEAVE') {
      stats.leaveCount += 1;
    }
  }

  await ClassSession.findByIdAndUpdate(
    classSessionId,
    stats,
    {
      new: true,
      session,
    },
  );
};

export const ClassSessionServices = {
  syncClassSessionsIntoDB,
  getCurriculumClassScheduleStatusFromDB,
  syncSingleOfferedSubjectClassSessionsIntoDB,
  getAllClassSessionsFromDB,
  getInstructorClassSessionsFromDB,
  getStudentClassSessionsFromDB,
  assertInstructorOwnsClassSession,
  getInstructorClassSessionDetailsFromDB,
  getClassSessionRescheduleAvailabilityFromDB,
  startClassSessionIntoDB,
  completeClassSessionIntoDB,
  rescheduleClassSessionIntoDB,
  cancelClassSessionIntoDB,
  getStudentClassSessionDetailsFromDB,
  getSingleClassSessionFromDB,
  getRoleDashboardSummaryFromDB,
  getClassSessionFilterOptionsFromDB,
  recalculateClassSessionAttendanceCounts,
};
