import { type ClientSession } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import { Student } from '../student/student.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { ClassSession } from './classSession.model.js';
import type {
  TClassSession,
  TSyncClassSessionResult,
} from './classSession.interface.js';
import { StudentAttendance } from '../studentAttendance/studentAttendance.model.js';
import {
  formatUtcDateKey,
  getUtcDayLabel,
  normalizeUtcDate,
} from './classSession.utils.js';

type TPopulatedStudent = {
  _id: { toString(): string };
  id: string;
  name: unknown;
  email: string;
  contactNo: string;
};

const resolveInstructorIdFromUserId = async (userId: string) => {
  const instructor = await Instructor.findOne({ id: userId }).select('_id');

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  return instructor._id;
};

const resolveStudentIdFromUserId = async (userId: string) => {
  const student = await Student.findOne({ id: userId }).select('_id');

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  return student._id;
};

const paginate = (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

const buildSessionFilter = async (query: Record<string, unknown>) => {
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

const buildSessionQuery = (filter: Record<string, unknown>) => {
  return ClassSession.find(filter)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('academicDepartment', 'name')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('offeredSubject', 'section days startTime endTime')
    .sort({ date: 1, startTime: 1 });
};

const ensureClassSessionsForOfferedSubjects = async (offeredSubjectIds: string[]) => {
  if (!offeredSubjectIds.length) {
    return;
  }

  const existingSessions = await ClassSession.find({
    offeredSubject: { $in: offeredSubjectIds },
  }).select('offeredSubject');

  const existingOfferedSubjectIds = new Set(
    existingSessions.map((item) => item.offeredSubject.toString()),
  );

  const missingOfferedSubjectIds = offeredSubjectIds.filter(
    (item) => !existingOfferedSubjectIds.has(item),
  );

  for (const offeredSubjectId of missingOfferedSubjectIds) {
    await syncSingleOfferedSubjectClassSessionsIntoDB(offeredSubjectId);
  }
};

const countEnrolledStudentsForOfferedSubject = async (offeredSubjectId: string) => {
  return EnrolledSubject.countDocuments({
    offeredSubject: offeredSubjectId,
    isEnrolled: true,
  });
};

const buildClassSessionSeeds = async (
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
  const selectedDays = new Set(offeredSubject.days);
  const startDate = normalizeUtcDate(semesterRegistration.startDate);
  const endDate = normalizeUtcDate(semesterRegistration.endDate);
  const sessions: Array<Partial<TClassSession>> = [];

  let current = new Date(startDate);
  let sessionNumber = 1;

  while (current.getTime() <= endDate.getTime()) {
    const day = getUtcDayLabel(current);

    if (selectedDays.has(day)) {
      sessions.push({
        offeredSubject: offeredSubject._id,
        semesterRegistration: offeredSubject.semesterRegistration,
        academicSemester: offeredSubject.academicSemester,
        academicDepartment: offeredSubject.academicDepartment,
        subject: offeredSubject.subject,
        instructor: offeredSubject.instructor,
        sessionNumber,
        date: new Date(current),
        day,
        startTime: offeredSubject.startTime,
        endTime: offeredSubject.endTime,
        totalStudents,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        status: 'SCHEDULED',
      });

      sessionNumber += 1;
    }

    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return sessions;
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
  }).select('_id date status');

  const existingDateKeys = new Set(
    existingSessions.map((item) => formatUtcDateKey(item.date)),
  );
  const existingSessionMap = new Map(
    existingSessions.map((item) => [formatUtcDateKey(item.date), item]),
  );

  const missingSessions = sessions.filter((session) => {
    return !existingDateKeys.has(formatUtcDateKey(session.date as Date));
  });

  if (missingSessions.length) {
    await ClassSession.insertMany(missingSessions, { ordered: false });
  }

  const resyncableStatuses = new Set(['SCHEDULED', 'MISSED', 'CANCELLED']);
  const updates = sessions
    .map((session) => {
      const existing = existingSessionMap.get(formatUtcDateKey(session.date as Date));
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
              sessionNumber: session.sessionNumber,
              day: session.day,
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
  replaceScheduled?: boolean;
}) => {
  const offeredSubjectIds = payload.offeredSubjectId
    ? [payload.offeredSubjectId]
    : (
        await OfferedSubject.find().select('_id')
      ).map((item) => item._id.toString());

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
  const offeredSubjectIds = (
    await OfferedSubject.find({ instructor: instructorId }).select('_id')
  ).map((item) => item._id.toString());

  await ensureClassSessionsForOfferedSubjects(offeredSubjectIds);

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
  await ensureClassSessionsForOfferedSubjects(
    offeredSubjectIds.map((item) => item.toString()),
  );
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
        .populate('offeredSubject', 'section days startTime endTime')
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
    .populate('offeredSubject', 'section days startTime endTime');

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
    .populate('offeredSubject', 'section days startTime endTime')
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
    .populate('offeredSubject', 'section days startTime endTime')
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
    const offeredSubjectIds = (
      await OfferedSubject.find({ instructor: instructorId }).select('_id')
    ).map((item) => item._id.toString());

    await ensureClassSessionsForOfferedSubjects(offeredSubjectIds);

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

    await ensureClassSessionsForOfferedSubjects(
      enrolledSubjects.map((item) => item.offeredSubject.toString()),
    );

    const sessions = await ClassSession.find({
      offeredSubject: { $in: enrolledSubjects.map((item) => item.offeredSubject) },
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate('subject', 'title code')
      .populate('instructor', 'id name designation')
      .sort({ startTime: 1 });

    return {
      totalToday: sessions.length,
      scheduled: sessions.filter((item) => item.status === 'SCHEDULED').length,
      ongoing: sessions.filter((item) => item.status === 'ONGOING').length,
      completed: sessions.filter((item) => item.status === 'COMPLETED').length,
      sessions,
    };
  }

  const offeredSubjectIds = (await OfferedSubject.find().select('_id')).map((item) =>
    item._id.toString(),
  );
  await ensureClassSessionsForOfferedSubjects(offeredSubjectIds);

  const sessions = await ClassSession.find({
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  })
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
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
    {
      ...stats,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    {
      new: true,
      session,
    },
  );
};

export const ClassSessionServices = {
  syncClassSessionsIntoDB,
  syncSingleOfferedSubjectClassSessionsIntoDB,
  getAllClassSessionsFromDB,
  getInstructorClassSessionsFromDB,
  getStudentClassSessionsFromDB,
  assertInstructorOwnsClassSession,
  getInstructorClassSessionDetailsFromDB,
  startClassSessionIntoDB,
  getStudentClassSessionDetailsFromDB,
  getSingleClassSessionFromDB,
  getRoleDashboardSummaryFromDB,
  recalculateClassSessionAttendanceCounts,
};
