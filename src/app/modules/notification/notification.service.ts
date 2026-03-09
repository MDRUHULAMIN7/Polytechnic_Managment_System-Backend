import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Notification } from './notification.model.js';
import type {
  TNotificationCreateInput,
  TNotificationKind,
  TNotificationLevel,
} from './notification.interface.js';
import { socketService } from '../../socket/socket.service.js';
import { SocketEvent } from '../../socket/socket.types.js';
import { Student } from '../student/student.model.js';
import { User } from '../user/user.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import type { TUser } from '../user/user.interface.js';

const UNREAD_RETENTION_DAYS = 30;
const READ_RETENTION_DAYS = 7;

function normalizeNotification(doc: {
  _id: { toString(): string };
  kind: TNotificationKind;
  level: TNotificationLevel;
  title: string;
  message: string;
  actionUrl?: string | null;
  meta?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date | null;
  createdAt?: Date | null;
}) {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    level: doc.level,
    title: doc.title,
    message: doc.message,
    actionUrl: doc.actionUrl ?? undefined,
    meta: doc.meta ?? undefined,
    read: doc.isRead,
    readAt: doc.readAt?.toISOString(),
    createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function unreadExpiryAt(base: Date = new Date()) {
  return addDays(base, UNREAD_RETENTION_DAYS);
}

function readExpiryAt(base: Date = new Date()) {
  return addDays(base, READ_RETENTION_DAYS);
}

function pagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

async function getActiveRecipientsByRoles(
  roles: TUser['role'][],
  options?: { excludeUserId?: string },
) {
  const users = await User.find({
    role: { $in: roles },
    isDeleted: false,
    status: { $ne: 'blocked' },
    ...(options?.excludeUserId ? { id: { $ne: options.excludeUserId } } : {}),
  }).select('id role');

  return users.map((user) => ({
    userId: user.id,
    role: user.role,
  }));
}

async function getStudentRecipientsByOfferedSubject(offeredSubjectId: string) {
  const studentRefs = await EnrolledSubject.find({
    offeredSubject: offeredSubjectId,
    isEnrolled: true,
  }).distinct('student');

  if (!studentRefs.length) {
    return [];
  }

  const students = await Student.find({
    _id: { $in: studentRefs },
  }).select('id');

  return students.map((student) => ({
    userId: student.id,
    role: 'student' as const,
  }));
}

async function createManyIntoDB(inputs: TNotificationCreateInput[]) {
  if (!inputs.length) {
    return [];
  }

  return Notification.insertMany(
    inputs.map((input) => ({
      ...input,
      isRead: false,
      expiresAt: unreadExpiryAt(),
    })),
  );
}

async function createAndDispatch(inputs: TNotificationCreateInput[]) {
  const created = await createManyIntoDB(inputs);

  const eventByKind: Record<TNotificationKind, string> = {
    'class-started': SocketEvent.classStarted,
    'class-completed': SocketEvent.classCompleted,
    'class-cancelled': SocketEvent.classCancelled,
    'attendance-marked': SocketEvent.attendanceMarked,
    'offered-subject-assigned': SocketEvent.notificationCreated,
    'offered-subject-removed': SocketEvent.notificationCreated,
    'notice-published': SocketEvent.notificationCreated,
  };

  for (const item of created) {
    socketService.emitToUser(
      item.recipientUserId,
      item.recipientRole,
      eventByKind[item.kind],
      normalizeNotification(item),
    );
  }

  return created;
}

function formatPersonName(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'User';
  }

  const source = value as {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };

  return [source.firstName, source.middleName, source.lastName]
    .filter(Boolean)
    .join(' ');
}

function getDocumentId(value: unknown) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && '_id' in value) {
    const source = value as { _id?: { toString(): string } | string };
    if (typeof source._id === 'string') {
      return source._id;
    }

    return source._id?.toString() ?? '';
  }

  if (
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return value.toString();
  }

  return '';
}

function getSubjectSummary(subject: unknown) {
  const source = (subject ?? {}) as {
    title?: string;
    code?: string | number;
  };

  return {
    title: source.title ?? 'Subject',
    code: source.code ?? '',
  };
}

function getSemesterLabel(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'this semester';
  }

  const source = value as {
    academicSemester?: { name?: string; year?: string };
    shift?: string;
  };

  const semester = source.academicSemester
    ? [source.academicSemester.name, source.academicSemester.year]
        .filter(Boolean)
        .join(' ')
    : null;

  return [semester, source.shift].filter(Boolean).join(' | ') || 'this semester';
}

async function getMyNotificationsFromDB(
  userId: string,
  query: Record<string, unknown>,
) {
  const { page, limit, skip } = pagination(query);
  const searchTerm =
    typeof query.searchTerm === 'string' ? query.searchTerm.trim() : '';

  const filter: Record<string, unknown> = {
    recipientUserId: userId,
  };

  if (searchTerm) {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { message: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const [result, total] = await Promise.all([
    Notification.find(filter).sort('-createdAt -_id').skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.max(Math.ceil(total / limit), 1),
    },
    result: result.map(normalizeNotification),
  };
}

async function getUnreadCountFromDB(userId: string) {
  const unreadCount = await Notification.countDocuments({
    recipientUserId: userId,
    isRead: false,
  });

  return { unreadCount };
}

async function markAsReadIntoDB(notificationId: string, userId: string) {
  const readAt = new Date();
  const result = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientUserId: userId,
    },
    {
      isRead: true,
      readAt,
      expiresAt: readExpiryAt(readAt),
    },
    {
      new: true,
    },
  );

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Notification not found.');
  }

  return normalizeNotification(result);
}

async function markAllAsReadIntoDB(userId: string) {
  const readAt = new Date();
  await Notification.updateMany(
    {
      recipientUserId: userId,
      isRead: false,
    },
    {
      isRead: true,
      readAt,
      expiresAt: readExpiryAt(readAt),
    },
  );

  return null;
}

async function clearAllIntoDB(userId: string) {
  await Notification.deleteMany({
    recipientUserId: userId,
  });

  return null;
}

async function backfillRetentionIntoDB() {
  const now = new Date();

  await Promise.all([
    Notification.updateMany(
      {
        isRead: true,
        expiresAt: { $exists: false },
      },
      {
        expiresAt: readExpiryAt(now),
      },
    ),
    Notification.updateMany(
      {
        isRead: false,
        expiresAt: { $exists: false },
      },
      {
        expiresAt: unreadExpiryAt(now),
      },
    ),
  ]);

  return null;
}

async function notifyClassStarted(classSession: {
  _id: { toString(): string };
  offeredSubject: unknown;
  subject?: unknown;
  instructor?: unknown;
  startedAt?: Date | null;
  topic?: string | null;
  startTime?: string;
  endTime?: string;
}) {
  const classSessionId = classSession._id.toString();
  const subject = getSubjectSummary(classSession.subject);
  const instructor = classSession.instructor as {
    name?: unknown;
    designation?: string;
  };
  const studentRecipients = await getStudentRecipientsByOfferedSubject(
    getDocumentId(classSession.offeredSubject),
  );
  const adminRecipients = await getActiveRecipientsByRoles(['admin', 'superAdmin']);

  return createAndDispatch([
    ...studentRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'class-started' as const,
      level: 'info' as const,
      title: 'Class started',
      message: `${subject.title} has started${
        classSession.topic ? `: ${classSession.topic}` : ''
      }.`,
      actionUrl: `/dashboard/student/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        instructorName: formatPersonName(instructor?.name),
        instructorDesignation: instructor?.designation ?? '',
        startedAt: classSession.startedAt?.toISOString() ?? new Date().toISOString(),
        topic: classSession.topic ?? '',
        startTime: classSession.startTime ?? '',
        endTime: classSession.endTime ?? '',
      },
    })),
    ...adminRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'class-started' as const,
      level: 'info' as const,
      title: 'Class started',
      message: `${formatPersonName(instructor?.name)} started ${subject.title}.`,
      actionUrl: `/dashboard/admin/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        instructorName: formatPersonName(instructor?.name),
        startedAt: classSession.startedAt?.toISOString() ?? new Date().toISOString(),
      },
    })),
  ]);
}

async function notifyClassCompleted(classSession: {
  _id: { toString(): string };
  offeredSubject: unknown;
  subject?: unknown;
  completedAt?: Date | null;
  presentCount?: number;
  totalStudents?: number;
}) {
  const classSessionId = classSession._id.toString();
  const subject = getSubjectSummary(classSession.subject);
  const studentRecipients = await getStudentRecipientsByOfferedSubject(
    getDocumentId(classSession.offeredSubject),
  );
  const adminRecipients = await getActiveRecipientsByRoles(['admin', 'superAdmin']);

  return createAndDispatch([
    ...studentRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'class-completed' as const,
      level: 'success' as const,
      title: 'Class completed',
      message: `${subject.title} has been completed.`,
      actionUrl: `/dashboard/student/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        completedAt:
          classSession.completedAt?.toISOString() ?? new Date().toISOString(),
      },
    })),
    ...adminRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'class-completed' as const,
      level: 'success' as const,
      title: 'Class completed',
      message: `${subject.title} completed with ${classSession.presentCount ?? 0}/${
        classSession.totalStudents ?? 0
      } present.`,
      actionUrl: `/dashboard/admin/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
      },
    })),
  ]);
}

async function notifyClassCancelled(classSession: {
  _id: { toString(): string };
  offeredSubject: unknown;
  subject?: unknown;
  cancelledAt?: Date | null;
  date?: Date | null;
  startTime?: string;
}) {
  const classSessionId = classSession._id.toString();
  const subject = getSubjectSummary(classSession.subject);
  const studentRecipients = await getStudentRecipientsByOfferedSubject(
    getDocumentId(classSession.offeredSubject),
  );

  return createAndDispatch(
    studentRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'class-cancelled' as const,
      level: 'warning' as const,
      title: 'Class cancelled',
      message: `${subject.title} has been cancelled.`,
      actionUrl: `/dashboard/student/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        cancelledAt:
          classSession.cancelledAt?.toISOString() ?? new Date().toISOString(),
        scheduledDate: classSession.date?.toISOString() ?? '',
        startTime: classSession.startTime ?? '',
      },
    })),
  );
}

async function notifyAttendanceMarked(input: {
  classSession: {
    _id: { toString(): string };
    subject?: unknown;
    date?: Date | null;
  };
  attendance: Array<{
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LEAVE';
  }>;
  summary: {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    totalMarked: number;
  };
}) {
  const subject = getSubjectSummary(input.classSession.subject);
  const classSessionId = input.classSession._id.toString();
  const adminRecipients = await getActiveRecipientsByRoles(['admin', 'superAdmin']);

  return createAndDispatch([
    ...input.attendance.map((row) => ({
      recipientUserId: row.studentId,
      recipientRole: 'student' as const,
      kind: 'attendance-marked' as const,
      level:
        row.status === 'PRESENT'
          ? ('success' as const)
          : row.status === 'ABSENT'
            ? ('warning' as const)
            : ('info' as const),
      title: 'Attendance marked',
      message: `You were marked ${row.status} in ${subject.title}.`,
      actionUrl: `/dashboard/student/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        status: row.status,
        markedAt: new Date().toISOString(),
        classDate: input.classSession.date?.toISOString() ?? '',
      },
    })),
    ...adminRecipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'attendance-marked' as const,
      level: 'info' as const,
      title: 'Attendance submitted',
      message: `${subject.title} attendance submitted for ${input.summary.totalMarked} students.`,
      actionUrl: `/dashboard/admin/classes/${classSessionId}`,
      meta: {
        classSessionId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
        ...input.summary,
      },
    })),
  ]);
}

async function notifyOfferedSubjectAssigned(input: {
  instructorUserId: string;
  subject: unknown;
  semesterRegistration?: unknown;
  offeredSubjectId: string;
}) {
  const subject = getSubjectSummary(input.subject);

  return createAndDispatch([
    {
      recipientUserId: input.instructorUserId,
      recipientRole: 'instructor',
      kind: 'offered-subject-assigned',
      level: 'info',
      title: 'Subject assigned',
      message: `${subject.title} has been assigned to you for ${getSemesterLabel(
        input.semesterRegistration,
      )}.`,
      actionUrl: '/dashboard/instructor/offered-subjects',
      meta: {
        offeredSubjectId: input.offeredSubjectId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
      },
    },
  ]);
}

async function notifyOfferedSubjectRemoved(input: {
  instructorUserId: string;
  subject: unknown;
  semesterRegistration?: unknown;
  offeredSubjectId: string;
}) {
  const subject = getSubjectSummary(input.subject);

  return createAndDispatch([
    {
      recipientUserId: input.instructorUserId,
      recipientRole: 'instructor',
      kind: 'offered-subject-removed',
      level: 'warning',
      title: 'Subject removed',
      message: `${subject.title} has been removed from your teaching load for ${getSemesterLabel(
        input.semesterRegistration,
      )}.`,
      actionUrl: '/dashboard/instructor/offered-subjects',
      meta: {
        offeredSubjectId: input.offeredSubjectId,
        subjectTitle: subject.title,
        subjectCode: subject.code,
      },
    },
  ]);
}

async function notifyNoticePublished(input: {
  noticeId: string;
  title: string;
  targetAudience: 'student' | 'instructor' | 'admin' | 'public';
  createdBy?: string;
  priority?: string;
}) {
  const audienceRoles: TUser['role'][] =
    input.targetAudience === 'public'
      ? ['student', 'instructor', 'admin', 'superAdmin']
      : input.targetAudience === 'admin'
        ? ['admin', 'superAdmin']
        : [input.targetAudience];

  const recipients = await getActiveRecipientsByRoles(audienceRoles, {
    excludeUserId: input.createdBy,
  });

  return createAndDispatch(
    recipients.map((recipient) => ({
      recipientUserId: recipient.userId,
      recipientRole: recipient.role,
      kind: 'notice-published' as const,
      level: input.priority === 'urgent' ? ('warning' as const) : ('info' as const),
      title: 'New notice published',
      message: input.title,
      actionUrl: `/notices/${input.noticeId}`,
      meta: {
        noticeId: input.noticeId,
        targetAudience: input.targetAudience,
        priority: input.priority ?? 'normal',
      },
    })),
  );
}

export const NotificationService = {
  getMyNotificationsFromDB,
  getUnreadCountFromDB,
  markAsReadIntoDB,
  markAllAsReadIntoDB,
  clearAllIntoDB,
  backfillRetentionIntoDB,
  notifyClassStarted,
  notifyClassCompleted,
  notifyClassCancelled,
  notifyAttendanceMarked,
  notifyOfferedSubjectAssigned,
  notifyOfferedSubjectRemoved,
  notifyNoticePublished,
};
