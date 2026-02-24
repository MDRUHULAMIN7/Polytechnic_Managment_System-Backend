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
import QueryBuilder from '../../../builder/QueryBuilder.js';

const getMissingOfferedSubjectReasons = async ({
  subjectIds,
  semesterRegistration,
  academicSemester,
  academicDepartment,
  academicInstructor,
}: {
  subjectIds: string[];
  semesterRegistration: string;
  academicSemester: string;
  academicDepartment: string;
  academicInstructor: string;
}) => {
  const subjectDocs = await Subject.find({
    _id: { $in: subjectIds },
  }).select('_id title');

  const subjectTitleMap = new Map(
    subjectDocs.map((subject) => [subject._id.toString(), subject.title]),
  );

  const reasons: string[] = [];

  for (const subjectId of subjectIds) {
    const subjectLabel = `${subjectTitleMap.get(subjectId) || 'Subject'} (${subjectId})`;

    const hasAnyOffered = await OfferedSubject.exists({
      subject: subjectId,
    });

    if (!hasAnyOffered) {
      reasons.push(`${subjectLabel}: not offered yet`);
      continue;
    }

    const hasSameSemester = await OfferedSubject.exists({
      subject: subjectId,
      semesterRegistration,
      academicSemester,
    });

    if (!hasSameSemester) {
      reasons.push(
        `${subjectLabel}: offered but not in this curriculum semester/registration`,
      );
      continue;
    }

    const hasDepartmentInstructorMatch = await OfferedSubject.exists({
      subject: subjectId,
      semesterRegistration,
      academicSemester,
      academicDepartment,
      academicInstructor,
    });

    if (!hasDepartmentInstructorMatch) {
      reasons.push(
        `${subjectLabel}: offered but does not match your department/instructor`,
      );
      continue;
    }

    const hasSeat = await OfferedSubject.exists({
      subject: subjectId,
      semesterRegistration,
      academicSemester,
      academicDepartment,
      academicInstructor,
      maxCapacity: { $gt: 0 },
    });

    if (!hasSeat) {
      reasons.push(`${subjectLabel}: seat full (maxCapacity = 0)`);
      continue;
    }

    reasons.push(`${subjectLabel}: offered subject resolution failed`);
  }

  return reasons;
};

const createSemesterEnrollmentIntoDB = async (
  userId: string,
  payload: TCreateSemesterEnrollmentPayload,
) => {
  const { curriculum } = payload;

  const student = await Student.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1, academicInstructor: 1 },
  );

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  if (!student.academicDepartment || !student.academicInstructor) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Student department or instructor information is missing !',
    );
  }

  const selectedCurriculum = await Curriculum.findById(curriculum).select(
    'academicDepartment academicSemester semisterRegistration subjects totalCredit',
  );

  if (!selectedCurriculum) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found !');
  }

  if (!selectedCurriculum.subjects?.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This curriculum has no subjects to enroll !',
    );
  }

  if (
    selectedCurriculum.academicDepartment.toString() !==
    student.academicDepartment.toString()
  ) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This curriculum does not belong to your department !',
    );
  }

  const semesterRegistration = await SemesterRegistration.findById(
    selectedCurriculum.semisterRegistration,
  ).select('status totalCredit academicSemester');

  if (!semesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found !');
  }

  if (semesterRegistration.status !== 'ONGOING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Enrollment is allowed only for ONGOING semester registration. Current status is ${semesterRegistration.status}.`,
    );
  }

  if (
    semesterRegistration.academicSemester.toString() !==
    selectedCurriculum.academicSemester.toString()
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Curriculum and semester registration are not matched !',
    );
  }

  const isStudentAlreadySemesterEnrolled = await SemesterEnrollment.findOne({
    student: student._id,
    semesterRegistration: selectedCurriculum.semisterRegistration,
  }).select('_id');

  if (isStudentAlreadySemesterEnrolled) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'You are already enrolled for this semester registration !',
    );
  }

  const curriculumSubjectIds = selectedCurriculum.subjects.map((subjectId) =>
    subjectId.toString(),
  );

  const existingEnrolledSubjects = await EnrolledSubject.find({
    semesterRegistration: selectedCurriculum.semisterRegistration,
    student: student._id,
    subject: { $in: curriculumSubjectIds },
    isEnrolled: true,
  }).select('_id');

  if (existingEnrolledSubjects.length) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Student already has enrolled subject(s) from this curriculum !',
    );
  }

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
    {
      $unwind: '$enrolledSubjectData',
    },
    {
      $group: {
        _id: null,
        totalEnrolledCredits: { $sum: '$enrolledSubjectData.credits' },
      },
    },
  ]);

  const currentEnrolledCredits =
    currentEnrolledCreditAggregation.length > 0
      ? currentEnrolledCreditAggregation[0].totalEnrolledCredits
      : 0;

  const semesterCreditLimit = semesterRegistration.totalCredit;
  const curriculumTotalCredit = selectedCurriculum.totalCredit ?? 0;

  if (
    typeof semesterCreditLimit === 'number' &&
    currentEnrolledCredits + curriculumTotalCredit > semesterCreditLimit
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You have exceeded maximum number of credits !',
    );
  }

  const completedSubjects = await EnrolledSubject.find({
    student: student._id,
    isCompleted: true,
  }).select('subject');

  const completedSubjectIdSet = new Set(
    completedSubjects.map((completedSubject) => completedSubject.subject.toString()),
  );

  const curriculumSubjects = await Subject.find({
    _id: { $in: curriculumSubjectIds },
    isDeleted: { $ne: true },
  }).select('_id preRequisiteSubjects');

  if (curriculumSubjects.length !== curriculumSubjectIds.length) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'One or more curriculum subjects were not found !',
    );
  }

  const prerequisiteNotFulfilledSubjectIds = curriculumSubjects
    .filter((curriculumSubject) =>
      (curriculumSubject.preRequisiteSubjects || []).some(
        (preRequisiteSubject) =>
          !preRequisiteSubject.isDeleted &&
          !completedSubjectIdSet.has(preRequisiteSubject.subject.toString()),
      ),
    )
    .map((curriculumSubject) => curriculumSubject._id.toString());

  if (prerequisiteNotFulfilledSubjectIds.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Prerequisites are not fulfilled for subject(s): ${prerequisiteNotFulfilledSubjectIds.join(', ')}`,
    );
  }

  const offeredSubjects = await OfferedSubject.find({
    semesterRegistration: selectedCurriculum.semisterRegistration,
    academicSemester: selectedCurriculum.academicSemester,
    academicDepartment: student.academicDepartment,
    academicInstructor: student.academicInstructor,
    subject: { $in: curriculumSubjectIds },
    maxCapacity: { $gt: 0 },
  }).sort({ section: 1, createdAt: 1 });

  const offeredSubjectBySubjectId = new Map<string, (typeof offeredSubjects)[number]>();
  for (const offeredSubject of offeredSubjects) {
    const subjectId = offeredSubject.subject.toString();
    if (!offeredSubjectBySubjectId.has(subjectId)) {
      offeredSubjectBySubjectId.set(subjectId, offeredSubject);
    }
  }

  const missingOfferedSubjectIds = curriculumSubjectIds.filter(
    (subjectId) => !offeredSubjectBySubjectId.has(subjectId),
  );

  if (missingOfferedSubjectIds.length) {
    const reasonDetails = await getMissingOfferedSubjectReasons({
      subjectIds: missingOfferedSubjectIds,
      semesterRegistration: selectedCurriculum.semisterRegistration.toString(),
      academicSemester: selectedCurriculum.academicSemester.toString(),
      academicDepartment: student.academicDepartment.toString(),
      academicInstructor: student.academicInstructor.toString(),
    });
   console.log(reasonDetails)
    throw new AppError(
      StatusCodes.NOT_FOUND,
      `Some curriculum subjects can not be enrolled:\n${reasonDetails.join('\n')}`,
    );
  }

  const selectedOfferedSubjects = curriculumSubjectIds.map(
    (subjectId) => offeredSubjectBySubjectId.get(subjectId)!,
  );

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
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Failed to create semester enrollment !',
      );
    }

    const enrolledSubjectPayload = selectedOfferedSubjects.map(
      (offeredSubjectItem) => ({
        semesterRegistration: offeredSubjectItem.semesterRegistration,
        academicSemester: offeredSubjectItem.academicSemester,
        academicInstructor: offeredSubjectItem.academicInstructor,
        academicDepartment: offeredSubjectItem.academicDepartment,
        offeredSubject: offeredSubjectItem._id,
        subject: offeredSubjectItem.subject,
        student: student._id,
        instructor: offeredSubjectItem.instructor,
        isEnrolled: true,
      }),
    );

    const enrolledSubjects = await EnrolledSubject.insertMany(enrolledSubjectPayload, {
      session,
    });

    if (!enrolledSubjects.length) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Failed to auto enroll curriculum subjects !',
      );
    }

    const capacityUpdates = selectedOfferedSubjects.map((offeredSubjectItem) => ({
      updateOne: {
        filter: {
          _id: offeredSubjectItem._id,
          maxCapacity: { $gt: 0 },
        },
        update: {
          $inc: { maxCapacity: -1 },
        },
      },
    }));

    const capacityUpdateResult = await OfferedSubject.bulkWrite(capacityUpdates, {
      session,
    });

    if (capacityUpdateResult.modifiedCount !== selectedOfferedSubjects.length) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'One or more subjects became full during enrollment. Please try again !',
      );
    }

    await session.commitTransaction();

    return {
      semesterEnrollment,
      enrolledSubjects,
    };
  } catch (error: unknown) {
    await session.abortTransaction();

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'You are already enrolled for this semester registration !',
      );
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Failed to create semester enrollment !',
    );
  } finally {
    await session.endSession();
  }
};

const getMySemesterEnrollmentsFromDB = async (userId: string) => {
  const student = await Student.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  const result = await SemesterEnrollment.find({
    student: student._id,
  })
    .populate('curriculum', 'session regulation totalCredit')
    .populate('semesterRegistration', 'status shift startDate endDate')
    .populate('academicSemester', 'name year startMonth')
    .populate('academicDepartment', 'name')
    .sort('-createdAt');

  return result;
};

const getAllSemesterEnrollmentsFromDB = async (query: Record<string, unknown>) => {
  const semesterEnrollmentQuery = new QueryBuilder(
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

  const result = await semesterEnrollmentQuery.modelQuery;
  const meta = await semesterEnrollmentQuery.countTotal();

  return {
    meta,
    result,
  };
};

export const SemesterEnrollmentServices = {
  createSemesterEnrollmentIntoDB,
  getMySemesterEnrollmentsFromDB,
  getAllSemesterEnrollmentsFromDB,
};
