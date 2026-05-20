import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import type { TCreateSemesterEnrollmentPayload } from './semesterEnrollment.interface.js';
import { Student } from '../student/student.model.js';
import { Curriculum } from '../curriculum/curriculum.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import EnrolledSubject from '../enrolledSubject/enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import { SemesterEnrollment } from './semesterEnrollment.model.js';
import type { TUserRole } from '../user/user.interface.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { buildEnrolledSubjectSeed } from '../enrolledSubject/enrolledSubject.utils.js';
import { getMissingOfferedSubjectReasons } from './semesterEnrollment.utils.js';

/**
 * Creates a new semester enrollment for a student.
 * Handles complex validation logic: curriculum matching, prerequisite checks, credit limits, and seat capacity.
 */
const createSemesterEnrollmentIntoDB = async (
  userId: string,
  payload: TCreateSemesterEnrollmentPayload,
) => {
  const { curriculum } = payload;

  // 1. Resolve student and their academic context
  const student = await Student.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1, academicInstructor: 1 },
  );

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student record not found!');
  }

  if (!student.academicDepartment || !student.academicInstructor) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Student profile is incomplete: department or instructor info missing.',
    );
  }

  // 2. Resolve and validate curriculum
  const selectedCurriculum = await Curriculum.findById(curriculum)
    .populate('offeredSubjects')
    .select(
      'academicDepartment academicSemester semisterRegistration offeredSubjects totalCredit',
    );

  if (!selectedCurriculum) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Selected curriculum not found!');
  }

  const curriculumOfferedSubjects =
    (selectedCurriculum.offeredSubjects as unknown as any[]) || [];

  if (!curriculumOfferedSubjects.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This curriculum has no subjects assigned for enrollment.',
    );
  }

  // Department consistency check
  if (
    selectedCurriculum.academicDepartment.toString() !==
    student.academicDepartment.toString()
  ) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Access Denied: This curriculum belongs to a different department.',
    );
  }

  // 3. Resolve and validate semester registration
  const semesterRegistration = await SemesterRegistration.findById(
    selectedCurriculum.semisterRegistration,
  ).select('status totalCredit academicSemester');

  if (!semesterRegistration) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Associated semester registration not found!',
    );
  }

  if (semesterRegistration.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Enrollment is only allowed for ONGOING registrations. Current status: ${semesterRegistration.status}.`,
    );
  }

  // Matching check
  if (
    semesterRegistration.academicSemester.toString() !==
    selectedCurriculum.academicSemester.toString()
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Data Inconsistency: Curriculum and semester registration periods do not match.',
    );
  }

  // 4. Check for existing enrollment
  const isAlreadyEnrolled = await SemesterEnrollment.exists({
    student: student._id,
    semesterRegistration: selectedCurriculum.semisterRegistration,
  });

  if (isAlreadyEnrolled) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'You have already submitted an enrollment for this semester.',
    );
  }

  const curriculumSubjectIds = curriculumOfferedSubjects.map((os: any) =>
    os.subject.toString(),
  );

  // Check if any subjects in this curriculum are already enrolled
  const existingEnrolledSubjects = await EnrolledSubject.exists({
    semesterRegistration: selectedCurriculum.semisterRegistration,
    student: student._id,
    subject: { $in: curriculumSubjectIds },
    isEnrolled: true,
  });

  if (existingEnrolledSubjects) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Some subjects in this curriculum are already enrolled in your record.',
    );
  }

  // 5. Credit limit validation
  const currentEnrolledCreditAggregation = await EnrolledSubject.aggregate([
    {
      $match: {
        semesterRegistration: selectedCurriculum.semisterRegistration,
        student: student._id,
        isEnrolled: true,
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
    { $unwind: '$enrolledSubjectData' },
    {
      $group: {
        _id: null,
        totalEnrolledCredits: { $sum: '$enrolledSubjectData.credits' },
      },
    },
  ]);

  const currentEnrolledCredits = currentEnrolledCreditAggregation[0]?.totalEnrolledCredits || 0;
  const semesterCreditLimit = semesterRegistration.totalCredit;
  const curriculumTotalCredit = selectedCurriculum.totalCredit ?? 0;

  if (
    typeof semesterCreditLimit === 'number' &&
    currentEnrolledCredits + curriculumTotalCredit > semesterCreditLimit
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Credit Limit Exceeded: Max ${semesterCreditLimit} allowed, current + requested = ${currentEnrolledCredits + curriculumTotalCredit}.`,
    );
  }

  // 6. Prerequisite validation
  const completedSubjects = await EnrolledSubject.find({
    student: student._id,
    isCompleted: true,
  }).select('subject');

  const completedSubjectIdSet = new Set(
    completedSubjects.map((sub) => sub.subject.toString()),
  );

  const curriculumSubjects = await Subject.find({
    _id: { $in: curriculumSubjectIds },
    isDeleted: { $ne: true },
  }).select('_id preRequisiteSubjects title');

  if (curriculumSubjects.length !== curriculumSubjectIds.length) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'One or more subjects in the curriculum could not be found.',
    );
  }

  const blockedSubjects = curriculumSubjects.filter((sub) =>
    (sub.preRequisiteSubjects || []).some(
      (pre) => !pre.isDeleted && !completedSubjectIdSet.has(pre.subject.toString()),
    ),
  );

  if (blockedSubjects.length) {
    const blockedLabels = blockedSubjects.map((s) => s.title).join(', ');
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Prerequisite requirements not met for: ${blockedLabels}`,
    );
  }

  // 7. Resolve Offered Subjects and check capacity
  const offeredSubjects = await OfferedSubject.find({
    semesterRegistration: selectedCurriculum.semisterRegistration,
    academicSemester: selectedCurriculum.academicSemester,
    academicDepartment: student.academicDepartment,
    academicInstructor: student.academicInstructor,
    subject: { $in: curriculumSubjectIds },
    maxCapacity: { $gt: 0 },
  }).sort({ createdAt: 1 });

  const offeredSubjectBySubjectId = new Map<string, any>();
  for (const offered of offeredSubjects as any[]) {
    const subjectId = offered.subject.toString();
    if (!offeredSubjectBySubjectId.has(subjectId)) {
      offeredSubjectBySubjectId.set(subjectId, offered);
    }
  }

  const missingOfferings = curriculumSubjectIds.filter(
    (id) => !offeredSubjectBySubjectId.has(id),
  );

  if (missingOfferings.length) {
    const reasons = await getMissingOfferedSubjectReasons({
      subjectIds: missingOfferings,
      semesterRegistration: selectedCurriculum.semisterRegistration.toString(),
      academicSemester: selectedCurriculum.academicSemester.toString(),
      academicDepartment: student.academicDepartment.toString(),
      academicInstructor: student.academicInstructor.toString(),
    });
    throw new AppError(
      StatusCodes.NOT_FOUND,
      `Enrollment blocked by offering issues:\n${reasons.join('\n')}`,
    );
  }

  const selectedOfferedSubjects = curriculumSubjectIds.map(
    (id) => offeredSubjectBySubjectId.get(id)!,
  );

  // 8. Execute Enrollment with Transaction
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [semesterEnrollment] = await SemesterEnrollment.create(
      [
        {
          student: student._id,
          curriculum: selectedCurriculum._id,
          semesterRegistration: selectedCurriculum.semisterRegistration,
          academicSemester: selectedCurriculum.academicSemester,
          academicDepartment: selectedCurriculum.academicDepartment,
          status: 'APPROVED',
          fees: 0,
          isPaid: false,
        },
      ],
      { session },
    );

    if (!semesterEnrollment) {
      throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create enrollment record.');
    }

    const enrolledSubjectPayload = selectedOfferedSubjects.map((offered: any) =>
      buildEnrolledSubjectSeed({
        offeredSubject: offered,
        student: student._id,
      }),
    );

    const enrolledSubjects = await EnrolledSubject.insertMany(enrolledSubjectPayload, {
      session,
    });

    if (!enrolledSubjects.length) {
      throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to register curriculum subjects.');
    }

    // Atomic capacity reduction
    const capacityUpdates = selectedOfferedSubjects.map((offered: any) => ({
      updateOne: {
        filter: { _id: offered._id, maxCapacity: { $gt: 0 } },
        update: { $inc: { maxCapacity: -1 } },
      },
    }));

    const capacityResult = await OfferedSubject.bulkWrite(capacityUpdates, { session });

    if (capacityResult.modifiedCount !== selectedOfferedSubjects.length) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'One or more subjects became full during enrollment. Please refresh and try again.',
      );
    }

    await session.commitTransaction();

    return {
      semesterEnrollment,
      enrolledSubjects,
    };
  } catch (error: any) {
    await session.abortTransaction();

    if (error.code === 11000) {
      throw new AppError(StatusCodes.CONFLICT, 'You have already enrolled for this semester.');
    }

    if (error instanceof AppError) throw error;
    
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      error.message || 'Enrollment failed due to an internal error.',
    );
  } finally {
    await session.endSession();
  }
};

const getMySemesterEnrollmentsFromDB = async (userId: string) => {
  const student = await Student.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student profile not found!');
  }

  return await SemesterEnrollment.find({ student: student._id })
    .populate('curriculum', 'session regulation totalCredit')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('academicSemester', 'name year startMonth')
    .populate('academicDepartment', 'name')
    .sort('-createdAt')
    .lean();
};

const getSemesterEnrollmentsForStudentFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const student = await Student.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student profile not found!');
  }

  const enrollmentQuery = new QueryBuilder(
    SemesterEnrollment.find({ student: student._id })
      .populate('student', 'id name')
      .populate('curriculum', 'session regulation totalCredit')
      .populate('semesterRegistration', 'status shift startDate endDate')
      .populate('academicSemester', 'name year startMonth')
      .populate('academicDepartment', 'name')
      .lean(),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await enrollmentQuery.modelQuery;
  const meta = await enrollmentQuery.countTotal();

  return { meta, result };
};

const getSingleSemesterEnrollmentFromDB = async (
  id: string,
  role: TUserRole,
  userId: string,
) => {
  const baseQuery = SemesterEnrollment.findById(id)
    .populate('student', 'id name')
    .populate('curriculum', 'session regulation totalCredit')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('academicSemester', 'name year startMonth')
    .populate('academicDepartment', 'name')
    .lean();

  if (role === 'student') {
    const student = await Student.findOne({ id: userId }, { _id: 1 });
    if (!student) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Student record not found!');
    }
    baseQuery.where({ student: student._id });
  }

  const result = await baseQuery;

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester enrollment details not found!');
  }

  return result;
};

const getAllSemesterEnrollmentsFromDB = async (query: Record<string, unknown>) => {
  const enrollmentQuery = new QueryBuilder(
    SemesterEnrollment.find()
      .populate('student', 'id name')
      .populate('curriculum', 'session regulation totalCredit')
      .populate('semesterRegistration', 'status shift startDate endDate')
      .populate('academicSemester', 'name year startMonth')
      .populate('academicDepartment', 'name')
      .lean(),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await enrollmentQuery.modelQuery;
  const meta = await enrollmentQuery.countTotal();

  return { meta, result };
};

export const SemesterEnrollmentServices = {
  createSemesterEnrollmentIntoDB,
  getMySemesterEnrollmentsFromDB,
  getSemesterEnrollmentsForStudentFromDB,
  getSingleSemesterEnrollmentFromDB,
  getAllSemesterEnrollmentsFromDB,
};
