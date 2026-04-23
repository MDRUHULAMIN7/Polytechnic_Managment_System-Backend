import { type ClientSession } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { Curriculum } from '../curriculum/curriculum.model.js';
import { ClassSession } from './classSession.model.js';
import type {
  TFilterOption,
  TPopulatedStudent,
  TSemesterRegistrationOptionSource,
  TSyncClassSessionResult,
} from './classSession.interface.js';
import { StudentAttendance } from '../studentAttendance/studentAttendance.model.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  buildClassSessionSeeds,
  buildSemesterRegistrationOption,
  buildSessionFilter,
  buildSessionQuery,
  buildSubjectOption,
  countEnrolledStudentsForOfferedSubject,
  formatUtcDateKey,
  getUtcDayLabel,
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

const getOfferedSubjectIdsForCurriculum = async (curriculumId: string) => {
  const curriculum = await Curriculum.findById(curriculumId).select(
    'academicDepartment academicSemester semisterRegistration subjects',
  );

  if (!curriculum) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found !');
  }

  const subjectIds = curriculum.subjects.map((subjectId) => subjectId.toString());

  if (!subjectIds.length) {
    return [];
  }

  const offeredSubjects = await OfferedSubject.find({
    academicDepartment: curriculum.academicDepartment,
    academicSemester: curriculum.academicSemester,
    semesterRegistration: curriculum.semisterRegistration,
    subject: { $in: subjectIds },
  }).select('_id');

  return offeredSubjects.map((item) => item._id.toString());
};

const syncSingleOfferedSubjectClassSessionsIntoDB = async (
  offeredSubjectId: string,
  options?: { replaceScheduled?: boolean },
): Promise<TSyncClassSessionResult> => {
  const sessions = await buildClassSessionSeeds(offeredSubjectId);
  const totalStudents = sessions[0]?.totalStudents ?? 0;

  if (options?.replaceScheduled) {
    await ClassSession.deleteMany({
      offeredSubject: offeredSubjectId,
      status: { $in: ['SCHEDULED', 'MISSED', 'CANCELLED'] },
    });
  }

  if (!sessions.length) {
    return {
      offeredSubjectId,
      generatedCount: 0,
      skippedCount: 0,
      totalStudents,
    };
  }

  const existingSessions = await ClassSession.find({
    offeredSubject: offeredSubjectId,
  }).select('_id date status startTime room');

  const existingDateKeys = new Set(
    existingSessions.map((item) => buildSessionIdentityKey(item)),
  );
  const existingSessionMap = new Map(
    existingSessions.map((item) => [buildSessionIdentityKey(item), item]),
  );

  const missingSessions = sessions.filter((session) => {
    return !existingDateKeys.has(
      buildSessionIdentityKey(
        session as { date: Date; startTime?: string; room?: string },
      ),
    );
  });

  if (missingSessions.length) {
    await ClassSession.insertMany(missingSessions, { ordered: false });
  }

  const resyncableStatuses = new Set(['SCHEDULED', 'MISSED', 'CANCELLED']);
  const updates = sessions
    .map((session) => {
      const existing = existingSessionMap.get(
        buildSessionIdentityKey(
          session as { date: Date; startTime?: string; room?: string },
        ),
      );
      if (!existing || !resyncableStatuses.has(existing.status)) {
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
  }

  let generatedCount = 0;
  generatedCount = missingSessions.length;

  return {
    offeredSubjectId,
    generatedCount,
    skippedCount: sessions.length - generatedCount,
    totalStudents,
  };
};

const syncClassSessionsIntoDB = async (payload: {
  offeredSubjectId?: string;
  curriculumId?: string;
  replaceScheduled?: boolean;
}) => {
  let offeredSubjectIds: string[] = [];

  if (payload.offeredSubjectId) {
    offeredSubjectIds = [payload.offeredSubjectId];
  } else if (payload.curriculumId) {
    offeredSubjectIds = await getOfferedSubjectIdsForCurriculum(payload.curriculumId);
  } else {
    offeredSubjectIds = (
      await OfferedSubject.find().select('_id')
    ).map((item) => item._id.toString());
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
  const offeredSubjectIds = await getOfferedSubjectIdsForCurriculum(curriculumId);

  if (!offeredSubjectIds.length) {
    return {
      hasSessions: false,
      totalSessions: 0,
      totalOfferedSubjects: 0,
    };
  }

  const totalSessions = await ClassSession.countDocuments({
    offeredSubject: { $in: offeredSubjectIds },
  });

  return {
    hasSessions: totalSessions > 0,
    totalSessions,
    totalOfferedSubjects: offeredSubjectIds.length,
  };
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
        .populate('offeredSubject', 'section days startTime endTime scheduleBlocks')
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
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks');

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
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks');

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
    startTime: string;
    endTime: string;
  },
) => {
  const classSession = await ClassSession.findById(classSessionId);

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  if (['ONGOING', 'COMPLETED'].includes(classSession.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Class can not be rescheduled because it is ${classSession.status}.`,
    );
  }

  if (payload.startTime >= payload.endTime) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'End time must be later than start time.',
    );
  }

  const nextDate = normalizeUtcDate(payload.date);

  const result = await ClassSession.findByIdAndUpdate(
    classSessionId,
    {
      date: nextDate,
      day: getUtcDayLabel(nextDate),
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'SCHEDULED',
      cancelledAt: undefined,
      startedAt: undefined,
      completedAt: undefined,
      instructorCheckInTime: undefined,
      instructorCheckOutTime: undefined,
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks');

  if (result) {
    void NotificationService.notifyClassCancelled(result).catch((error) =>
      logRealtimeError('class cancellation', error),
    );
  }

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

  if (['ONGOING', 'COMPLETED'].includes(classSession.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Class can not be cancelled because it is ${classSession.status}.`,
    );
  }

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
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks');

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
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks')
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

const getSingleClassSessionFromDB = async (classSessionId: string) => {
  const classSession = await ClassSession.findById(classSessionId)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation email')
    .populate('room', 'roomName roomNumber buildingNumber capacity')
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('academicDepartment', 'name');

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
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
    statistics: {
      totalStudents: classSession.totalStudents,
      presentCount: classSession.presentCount,
      absentCount: classSession.absentCount,
      leaveCount: classSession.leaveCount,
      notMarkedCount:
        classSession.totalStudents -
        classSession.presentCount -
        classSession.absentCount -
        classSession.leaveCount,
    },
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
