import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import type {
  TEnrolledSubject,
  TEnrolledSubjectAuditLog,
  TEnrolledSubjectMarkEntry,
} from './enrolledSubject.interface.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { Student } from '../student/student.model.js';
import EnrolledSubject from './enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import type { TUserRole } from '../user/user.interface.js';
import {
  appendAuditLogs,
  buildEnrolledSubjectSeed,
  calculateGradeAndPoints,
  calculateMarkSummary,
  determineResultStatus,
  getReleasedMarkEntries,
} from './enrolledSubject.utils.js';

type TMarkEntryInput = {
  componentCode: string;
  obtainedMarks: number | null;
  remarks?: string;
};

const resolveActor = async (userId: string, role: TUserRole) => {
  if (role === 'instructor') {
    const instructor = await Instructor.findOne({ id: userId }, { _id: 1 });

    if (!instructor) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
    }

    return {
      actorRefId: instructor._id.toString(),
      actorUserId: userId,
      role,
      instructorId: instructor._id,
    };
  }

  return {
    actorRefId: userId,
    actorUserId: userId,
    role,
    instructorId: null,
  };
};

const ensureOfferedSubjectAccess = async (
  offeredSubjectId: string,
  actor: Awaited<ReturnType<typeof resolveActor>>,
) => {
  const offeredSubject = await OfferedSubject.findById(offeredSubjectId)
    .populate('subject', 'title code')
    .populate('instructor', 'id name');

  if (!offeredSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered subject not found !');
  }

  if (
    actor.role === 'instructor' &&
    actor.instructorId &&
    String(
      typeof offeredSubject.instructor === 'object' &&
        offeredSubject.instructor &&
        '_id' in offeredSubject.instructor
        ? offeredSubject.instructor._id
        : offeredSubject.instructor,
    ) !== actor.instructorId.toString()
  ) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden!');
  }

  return offeredSubject;
};

const createEnrolledSubjectIntoDB = async (
  userId: string,
  payload: TEnrolledSubject,
) => {
  const { offeredSubject } = payload;

  const isOfferedSubjectExists = await OfferedSubject.findById(offeredSubject);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered subject not found !');
  }

  if (isOfferedSubjectExists.maxCapacity <= 0) {
    throw new AppError(StatusCodes.BAD_GATEWAY, 'Room is full !');
  }

  const student = await Student.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  const isStudentAlreadyEnrolled = await EnrolledSubject.findOne({
    semesterRegistration: isOfferedSubjectExists.semesterRegistration,
    offeredSubject,
    student: student._id,
  });

  if (isStudentAlreadyEnrolled) {
    throw new AppError(StatusCodes.CONFLICT, 'Student is already enrolled !');
  }

  const subject = await Subject.findById(isOfferedSubjectExists.subject);
  const currentCredit = subject?.credits;

  const semesterRegistration = await SemesterRegistration.findById(
    isOfferedSubjectExists.semesterRegistration,
  ).select('totalCredit');

  const maxCredit = semesterRegistration?.totalCredit;

  const enrolledSubjects = await EnrolledSubject.aggregate([
    {
      $match: {
        semesterRegistration: isOfferedSubjectExists.semesterRegistration,
        student: student._id,
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'enrolledSubjectData',
      },
    },
    {
      $unwind: '$enrolledSubjectData',
    },
    {
      $group: {
        _id: null,
        totalEnrolledCredits: { $sum: '$enrolledSubjectData.credits' },
      },
    },
    {
      $project: {
        _id: 0,
        totalEnrolledCredits: 1,
      },
    },
  ]);

  const totalCredits =
    enrolledSubjects.length > 0 ? enrolledSubjects[0].totalEnrolledCredits : 0;

  if (totalCredits && maxCredit && totalCredits + currentCredit > maxCredit) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You have exceeded maximum number of credits !',
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [result] = await EnrolledSubject.insertMany(
      [
        buildEnrolledSubjectSeed({
          offeredSubject: isOfferedSubjectExists,
          student: student._id,
        }),
      ],
      { session },
    );

    if (!result) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Failed to enroll in this subject !',
      );
    }

    await OfferedSubject.findByIdAndUpdate(
      offeredSubject,
      {
        maxCapacity: isOfferedSubjectExists.maxCapacity - 1,
      },
      { session },
    );

    await session.commitTransaction();
    await session.endSession();

    return result;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const upsertEnrolledSubjectMarksIntoDB = async (
  userId: string,
  role: TUserRole,
  payload: {
    offeredSubject: string;
    student: string;
    entries: TMarkEntryInput[];
    reason?: string;
  },
) => {
  const actor = await resolveActor(userId, role);
  await ensureOfferedSubjectAccess(payload.offeredSubject, actor);

  const enrolledSubject = await EnrolledSubject.findOne({
    offeredSubject: payload.offeredSubject,
    student: payload.student,
  });

  if (!enrolledSubject) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Enrolled subject not found !');
  }

  const entryMap = new Map(
    enrolledSubject.markEntries.map((entry) => [entry.componentCode, entry]),
  );
  const auditLogs: TEnrolledSubjectAuditLog[] = [];
  let touchedAny = false;

  for (const incoming of payload.entries) {
    const existingEntry = entryMap.get(incoming.componentCode);

    if (!existingEntry) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Assessment component not found: ${incoming.componentCode}`,
      );
    }

    if (
      incoming.obtainedMarks !== null &&
      incoming.obtainedMarks > existingEntry.fullMarks
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `${existingEntry.componentTitle} can not exceed ${existingEntry.fullMarks}.`,
      );
    }

    if (
      existingEntry.obtainedMarks === incoming.obtainedMarks &&
      (incoming.remarks ?? existingEntry.remarks ?? '') ===
        (existingEntry.remarks ?? '')
    ) {
      continue;
    }

    auditLogs.push({
      componentCode: existingEntry.componentCode,
      componentTitle: existingEntry.componentTitle,
      oldValue: existingEntry.obtainedMarks ?? null,
      newValue: incoming.obtainedMarks,
      reason: payload.reason ?? '',
      actorId: actor.actorUserId,
      actorRole: actor.role,
      changedAt: new Date(),
    });

    existingEntry.obtainedMarks = incoming.obtainedMarks;
    existingEntry.remarks = incoming.remarks ?? existingEntry.remarks ?? '';
    existingEntry.lastUpdatedAt = new Date();
    existingEntry.lastUpdatedBy = actor.actorUserId;
    touchedAny = true;
  }

  if (!touchedAny) {
    return enrolledSubject;
  }

  const recalculatedSummary = calculateMarkSummary(
    enrolledSubject.markEntries,
    enrolledSubject.markingSchemeSnapshot.totalMarks,
  );
  const gradeResult = calculateGradeAndPoints(
    recalculatedSummary.total,
    enrolledSubject.markingSchemeSnapshot.totalMarks,
  );

  enrolledSubject.markSummary = recalculatedSummary;
  enrolledSubject.grade = gradeResult.grade as TEnrolledSubject['grade'];
  enrolledSubject.gradePoints = gradeResult.gradePoints;
  enrolledSubject.resultStatus = determineResultStatus(
    enrolledSubject.markEntries,
    enrolledSubject.finalResultPublishedAt,
  );
  enrolledSubject.auditLogs = appendAuditLogs(
    enrolledSubject.auditLogs,
    auditLogs,
  );

  await enrolledSubject.save();

  await OfferedSubject.findByIdAndUpdate(payload.offeredSubject, {
    markingStatus: 'ONGOING',
  });

  return enrolledSubject;
};

const releaseOfferedSubjectComponentIntoDB = async (
  userId: string,
  role: TUserRole,
  payload: {
    offeredSubject: string;
    componentCode: string;
  },
) => {
  const actor = await resolveActor(userId, role);
  const offeredSubject = await ensureOfferedSubjectAccess(
    payload.offeredSubject,
    actor,
  );

  const component = offeredSubject.assessmentComponentsSnapshot.find(
    (item) => item.code === payload.componentCode,
  );

  if (!component) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Assessment component not found !');
  }

  const enrolledSubjects = await EnrolledSubject.find({
    offeredSubject: payload.offeredSubject,
  });

  if (!enrolledSubjects.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No enrolled students found for this offered subject.',
    );
  }

  for (const enrolledSubject of enrolledSubjects) {
    const targetEntry = enrolledSubject.markEntries.find(
      (entry) => entry.componentCode === payload.componentCode,
    );

    if (!targetEntry || targetEntry.obtainedMarks === null) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `All students must have ${component.title} marks before release.`,
      );
    }
  }

  const now = new Date();

  for (const enrolledSubject of enrolledSubjects) {
    const targetEntry = enrolledSubject.markEntries.find(
      (entry) => entry.componentCode === payload.componentCode,
    ) as TEnrolledSubjectMarkEntry;

    targetEntry.isReleased = true;
    targetEntry.releasedAt = now;
    enrolledSubject.markSummary = calculateMarkSummary(
      enrolledSubject.markEntries,
      enrolledSubject.markingSchemeSnapshot.totalMarks,
    );
    enrolledSubject.resultStatus = determineResultStatus(
      enrolledSubject.markEntries,
      enrolledSubject.finalResultPublishedAt,
    );
    await enrolledSubject.save();
  }

  const nextReleasedCodes = Array.from(
    new Set([...offeredSubject.releasedComponentCodes, payload.componentCode]),
  );

  const nextMarkingStatus =
    offeredSubject.finalResultPublishedAt || nextReleasedCodes.length === 0
      ? offeredSubject.markingStatus
      : 'PARTIALLY_RELEASED';

  await OfferedSubject.findByIdAndUpdate(payload.offeredSubject, {
    releasedComponentCodes: nextReleasedCodes,
    markingStatus: nextMarkingStatus,
  });

  return { componentCode: payload.componentCode };
};

const publishOfferedSubjectFinalResultIntoDB = async (
  userId: string,
  role: TUserRole,
  payload: {
    offeredSubject: string;
  },
) => {
  if (role !== 'admin' && role !== 'superAdmin') {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only admin can publish final results.',
    );
  }

  const actor = await resolveActor(userId, role);
  const offeredSubject = await ensureOfferedSubjectAccess(
    payload.offeredSubject,
    actor,
  );

  const enrolledSubjects = await EnrolledSubject.find({
    offeredSubject: payload.offeredSubject,
  });

  if (!enrolledSubjects.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'No enrolled students found for this offered subject.',
    );
  }

  for (const enrolledSubject of enrolledSubjects) {
    const missingRequired = enrolledSubject.markEntries.some(
      (entry) => entry.isRequired && entry.obtainedMarks === null,
    );

    if (missingRequired) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'All required marks must be entered before final publish.',
      );
    }
  }

  const publishedAt = new Date();

  await EnrolledSubject.updateMany(
    { offeredSubject: payload.offeredSubject },
    {
      finalResultPublishedAt: publishedAt,
      isCompleted: true,
      resultStatus: 'FINAL_PUBLISHED',
    },
  );

  await OfferedSubject.findByIdAndUpdate(payload.offeredSubject, {
    finalResultPublishedAt: publishedAt,
    markingStatus: 'FINAL_PUBLISHED',
  });

  return { publishedAt };
};

const getOfferedSubjectMarkSheetFromDB = async (
  offeredSubjectId: string,
  userId: string,
  role: TUserRole,
) => {
  const actor = await resolveActor(userId, role);
  const offeredSubject = await ensureOfferedSubjectAccess(offeredSubjectId, actor);

  const enrolledSubjects = await EnrolledSubject.find({
    offeredSubject: offeredSubjectId,
  })
    .populate('student', 'id name')
    .sort({ 'student.id': 1, _id: 1 })
    .lean();

  return {
    offeredSubject,
    enrolledSubjects,
  };
};

const getAllEnrolledSubjectsFromDB = async (query: Record<string, unknown>) => {
  const enrolledSubjectQuery = new QueryBuilder(
    EnrolledSubject.find()
      .select(
        'subject student instructor markSummary resultStatus grade gradePoints finalResultPublishedAt isCompleted',
      )
      .populate('academicSemester', 'name year startMonth')
      .populate('subject', 'title code credits subjectType markingScheme')
      .populate('student', 'id name')
      .populate('instructor', 'id name designation')
      .lean(),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await enrolledSubjectQuery.modelQuery;
  const meta = await enrolledSubjectQuery.countTotal();
  return {
    meta,
    result,
  };
};

const getMyEnrolledSubjectsFromDB = async (userId: string) => {
  const student = await Student.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  const result = await EnrolledSubject.find({
    student: student._id,
  })
    .populate(
      'semesterRegistration',
      'academicSemester status shift startDate endDate totalCredit',
    )
    .populate('academicSemester', 'name year')
    .populate(
      'offeredSubject',
      'section days startTime endTime releasedComponentCodes finalResultPublishedAt markingStatus',
    )
    .populate('subject', 'title code credits regulation subjectType markingScheme')
    .populate('instructor', 'id name designation email')
    .sort('-_id')
    .lean();

  return result.map((item) => {
    const visibleEntries = getReleasedMarkEntries(item.markEntries);
    const releasedSummary = calculateMarkSummary(
      visibleEntries,
      item.markingSchemeSnapshot.totalMarks,
    );

    return {
      ...item,
      markEntries: visibleEntries,
      markSummary: item.finalResultPublishedAt ? item.markSummary : releasedSummary,
      grade: item.finalResultPublishedAt ? item.grade : 'NA',
      gradePoints: item.finalResultPublishedAt ? item.gradePoints : 0,
      isCompleted: Boolean(item.finalResultPublishedAt),
      resultStatus: item.finalResultPublishedAt
        ? item.resultStatus
        : determineResultStatus(visibleEntries, null),
    };
  });
};

export const EnrolledSubjectServices = {
  createEnrolledSubjectIntoDB,
  upsertEnrolledSubjectMarksIntoDB,
  releaseOfferedSubjectComponentIntoDB,
  publishOfferedSubjectFinalResultIntoDB,
  getOfferedSubjectMarkSheetFromDB,
  getAllEnrolledSubjectsFromDB,
  getMyEnrolledSubjectsFromDB,
};
