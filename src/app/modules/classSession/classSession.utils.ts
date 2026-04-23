import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import type {
  TDays,
  TOfferedSubjectClassType,
  TScheduleBlock,
} from '../OfferedSubject/OfferedSubject.interface.js';
import { Student } from '../student/student.model.js';
import type { TClassSession, TFilterOption, TSemesterRegistrationOptionSource } from './classSession.interface.js';
import { ClassSession } from './classSession.model.js';
import { Subject } from '../subject/subject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';

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
    .populate('offeredSubject', 'section days startTime endTime scheduleBlocks')
    .sort({ date: 1, startTime: 1 });
};



export const countEnrolledStudentsForOfferedSubject = async (offeredSubjectId: string) => {
  return EnrolledSubject.countDocuments({
    offeredSubject: offeredSubjectId,
    isEnrolled: true,
  });
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
  const startDate = normalizeUtcDate(semesterRegistration.startDate);
  const endDate = normalizeUtcDate(semesterRegistration.endDate);
  const sessions: Array<Partial<TClassSession>> = [];

  const resolvedScheduleBlocks: Array<{
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
        startTimeSnapshot: offeredSubject.startTime,
        endTimeSnapshot: offeredSubject.endTime,
      }));

  if (!resolvedScheduleBlocks.length) {
    return [];
  }

  let current = new Date(startDate);

  while (current.getTime() <= endDate.getTime()) {
    const day = getUtcDayLabel(current);

    resolvedScheduleBlocks
      .filter((block) => block.day === day)
      .forEach((block) => {
        sessions.push({
          offeredSubject: offeredSubject._id,
          semesterRegistration: offeredSubject.semesterRegistration,
          academicSemester: offeredSubject.academicSemester,
          academicDepartment: offeredSubject.academicDepartment,
          subject: offeredSubject.subject,
          instructor: offeredSubject.instructor,
          room: block.room,
          classType: block.classType,
          date: new Date(current),
          day,
          startPeriod: block.startPeriod,
          periodCount: block.periodCount,
          periodNumbers: block.periodNumbers ?? [],
          startTime: block.startTimeSnapshot,
          endTime: block.endTimeSnapshot,
          totalStudents,
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          status: 'SCHEDULED',
        });
      });

    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return sessions
    .sort((left, right) => {
      const leftDate = new Date(left.date as Date).getTime();
      const rightDate = new Date(right.date as Date).getTime();
      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return String(left.startTime ?? '').localeCompare(String(right.startTime ?? ''));
    })
    .map((session, index) => ({
      ...session,
      sessionNumber: index + 1,
    }));
};
