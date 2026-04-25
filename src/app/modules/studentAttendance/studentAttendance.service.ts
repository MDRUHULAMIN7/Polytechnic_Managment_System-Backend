import mongoose, { type PipelineStage } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { ClassSession } from '../classSession/classSession.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import { StudentAttendance } from './studentAttendance.model.js';
import { ClassSessionServices } from '../classSession/classSession.service.js';
import { resolveInstructorIdFromUserId, resolveStudentIdFromUserId } from '../classSession/classSession.utils.js';
import { NotificationService } from '../notification/notification.service.js';
import { Student } from '../student/student.model.js';

function logRealtimeError(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Realtime notification failed for ${action}: ${detail}\n`);
}

const submitStudentAttendanceIntoDB = async (
  userId: string,
  payload: {
    classSessionId: string;
    attendance: Array<{
      studentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LEAVE';
      remarks?: string | null;
    }>;
  },
) => {
  const instructorId = await resolveInstructorIdFromUserId(userId);
  const classSession = await ClassSession.findOne({
    _id: payload.classSessionId,
    instructor: instructorId,
  });

  if (!classSession) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden !');
  }

  if (classSession.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Attendance can be submitted only while the class is ONGOING. Current status is ${classSession.status}.`,
    );
  }

  const enrolledSubjects = await EnrolledSubject.find({
    offeredSubject: classSession.offeredSubject,
    isEnrolled: true,
  }).select('_id student');

  const allowedStudents = new Map(
    enrolledSubjects.map((item) => [item.student.toString(), item]),
  );

  if (allowedStudents.size !== payload.attendance.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Attendance must be provided for all enrolled students',
    );
  }

  const seenStudents = new Set<string>();

  for (const row of payload.attendance) {
    if (!allowedStudents.has(row.studentId)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'One or more students do not belong to this class',
      );
    }

    if (seenStudents.has(row.studentId)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Duplicate student attendance entries are not allowed',
      );
    }

    seenStudents.add(row.studentId);
  }

  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const operations = payload.attendance.map((row) => {
      const enrolledSubject = allowedStudents.get(row.studentId);

      return {
        updateOne: {
          filter: {
            classSession: classSession._id,
            student: new mongoose.Types.ObjectId(row.studentId),
          },
          update: {
            $set: {
              offeredSubject: classSession.offeredSubject,
              enrolledSubject: enrolledSubject!._id,
              student: new mongoose.Types.ObjectId(row.studentId),
              status: row.status,
              remarks: row.remarks ?? undefined,
              markedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    await StudentAttendance.bulkWrite(operations, {
      session: dbSession,
      ordered: false,
    });

    await ClassSessionServices.recalculateClassSessionAttendanceCounts(
      classSession._id.toString(),
      dbSession,
    );

    const updatedClassSession = await ClassSession.findById(classSession._id)
      .session(dbSession)
      .populate('subject', 'title code')
      .populate('instructor', 'id name designation');

    await dbSession.commitTransaction();
    await dbSession.endSession();

    if (updatedClassSession) {
      const studentIds = await Student.find({
        _id: {
          $in: payload.attendance.map((row) => new mongoose.Types.ObjectId(row.studentId)),
        },
      }).select('id');

      const userIdsByStudentId = new Map(
        studentIds.map((student) => [student._id.toString(), student.id]),
      );

      void NotificationService.notifyAttendanceMarked({
        classSession: updatedClassSession,
        attendance: payload.attendance
          .map((row) => ({
            studentId: userIdsByStudentId.get(row.studentId) ?? '',
            status: row.status,
          }))
          .filter((row) => row.studentId),
        summary: {
          totalMarked: payload.attendance.length,
          presentCount: updatedClassSession.presentCount ?? 0,
          absentCount: updatedClassSession.absentCount ?? 0,
          leaveCount: updatedClassSession.leaveCount ?? 0,
        },
      }).catch((error) => logRealtimeError('attendance submission', error));
    }

    return {
      classSessionId: classSession._id,
      status: updatedClassSession?.status ?? classSession.status,
      totalMarked: payload.attendance.length,
      presentCount: updatedClassSession?.presentCount ?? 0,
      absentCount: updatedClassSession?.absentCount ?? 0,
      leaveCount: updatedClassSession?.leaveCount ?? 0,
      classSession: updatedClassSession,
    };
  } catch (error) {
    await dbSession.abortTransaction();
    await dbSession.endSession();
    throw error;
  }
};

const updateStudentAttendanceIntoDB = async (
  attendanceId: string,
  userId: string,
  payload: {
    status: 'PRESENT' | 'ABSENT' | 'LEAVE';
    remarks?: string | null;
  },
) => {
  const instructorId = await resolveInstructorIdFromUserId(userId);
  const attendance = await StudentAttendance.findById(attendanceId);

  if (!attendance) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Attendance record not found !');
  }

  const classSession = await ClassSession.findOne({
    _id: attendance.classSession,
    instructor: instructorId,
  }).select('_id status');

  if (!classSession) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden !');
  }

  if (classSession.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Attendance can be updated only while the class is ONGOING. Current status is ${classSession.status}.`,
    );
  }

  const result = await StudentAttendance.findByIdAndUpdate(
    attendanceId,
    {
      status: payload.status,
      remarks: payload.remarks ?? undefined,
      markedAt: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate('student', 'id name email contactNo')
    .populate('classSession');

  await ClassSessionServices.recalculateClassSessionAttendanceCounts(
    classSession._id.toString(),
  );

  const refreshedClassSession = await ClassSession.findById(classSession._id)
    .populate('subject', 'title code');

  const student = result?.student as
    | { id?: string }
    | string
    | null
    | undefined;

  const studentId =
    typeof student === 'string' ? null : (student?.id ?? null);

  if (refreshedClassSession && studentId && result) {
    void NotificationService.notifyAttendanceMarked({
      classSession: refreshedClassSession,
      attendance: [
        {
          studentId,
          status: result.status,
        },
      ],
      summary: {
        totalMarked: 1,
        presentCount: refreshedClassSession.presentCount ?? 0,
        absentCount: refreshedClassSession.absentCount ?? 0,
        leaveCount: refreshedClassSession.leaveCount ?? 0,
      },
    }).catch((error) => logRealtimeError('attendance update', error));
  }

  return result;
};

const getClassAttendanceFromDB = async (
  classSessionId: string,
  userId: string,
  role: string,
) => {
  if (role === 'instructor') {
    await ClassSessionServices.assertInstructorOwnsClassSession(
      classSessionId,
      userId,
    );
  }

  const classSession = await ClassSession.findById(classSessionId)
    .populate('subject', 'title code')
    .populate('instructor', 'id name designation')
    .populate('offeredSubject', 'days startTime endTime')
    .populate('semesterRegistration', 'status shift startDate endDate');

  if (!classSession) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Class session not found !');
  }

  const attendance = await StudentAttendance.find({
    classSession: classSessionId,
  })
    .populate('student', 'id name email contactNo')
    .sort({ createdAt: 1 });

  return {
    classSession,
    attendance,
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

const getMyAttendanceSummaryFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const studentId = await resolveStudentIdFromUserId(userId);
  const pipeline: PipelineStage[] = [
    {
      $match: {
        student: studentId,
      },
    },
    {
      $lookup: {
        from: 'classsessions',
        localField: 'classSession',
        foreignField: '_id',
        as: 'classSession',
      },
    },
    {
      $unwind: '$classSession',
    },
  ];

  if (
    typeof query.semesterRegistration === 'string' &&
    query.semesterRegistration.trim()
  ) {
    pipeline.push({
      $match: {
        'classSession.semesterRegistration': new mongoose.Types.ObjectId(
          query.semesterRegistration.trim(),
        ),
      },
    });
  }

  if (typeof query.subject === 'string' && query.subject.trim()) {
    pipeline.push({
      $match: {
        'classSession.subject': new mongoose.Types.ObjectId(query.subject.trim()),
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: '$classSession.subject',
        totalClasses: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0],
          },
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0],
          },
        },
        leaveCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'LEAVE'] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject',
      },
    },
    {
      $unwind: '$subject',
    },
    {
      $project: {
        _id: 0,
        subject: {
          _id: '$subject._id',
          title: '$subject.title',
          code: '$subject.code',
        },
        totalClasses: 1,
        presentCount: 1,
        absentCount: 1,
        leaveCount: 1,
        attendancePercentage: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $eq: ['$totalClasses', 0] },
                    0,
                    { $divide: ['$presentCount', '$totalClasses'] },
                  ],
                },
                100,
              ],
            },
            2,
          ],
        },
      },
    },
  );

  const result = await StudentAttendance.aggregate(pipeline);

  return result.map((item) => ({
    ...item,
    status:
      item.attendancePercentage >= 75
        ? 'GOOD'
        : item.attendancePercentage >= 65
          ? 'WARNING'
          : 'CRITICAL',
  }));
};

export const StudentAttendanceServices = {
  submitStudentAttendanceIntoDB,
  updateStudentAttendanceIntoDB,
  getClassAttendanceFromDB,
  getMyAttendanceSummaryFromDB,
};
