import mongoose from 'mongoose';
import type { TEnrolledSubject } from './enrolledSubject.interface.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';
import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import { Student } from '../student/student.model.js';
import EnrolledSubject from './enrolledSubject.model.js';
import { Subject } from '../subject/subject.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import {
  calculateGradeAndPoints,
  ENROLLED_SUBJECT_TOTAL_MARKS,
} from './enrolledSubject.utils.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';

const createEnrolledSubjectIntoDB = async (
  userId: string,
  payload: TEnrolledSubject,
) => {
  /**
   * Step1: Check if the offered subject is exists
   * Step2: Check if the student is already enrolled
   * Step3: Check if the max credits exceed
   * Step4: Create an enrolled subject
   */

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

  // check total credits exceeds totalCredit
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

  // total enrolled credits + new enrolled subject credit > maxCredit
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

    const result = await EnrolledSubject.create(
      [
        {
          semesterRegistration: isOfferedSubjectExists.semesterRegistration,
          academicSemester: isOfferedSubjectExists.academicSemester,
          academicInstructor: isOfferedSubjectExists.academicInstructor,
          academicDepartment: isOfferedSubjectExists.academicDepartment,
          offeredSubject: offeredSubject,
          subject: isOfferedSubjectExists.subject,
          student: student._id,
          instructor: isOfferedSubjectExists.instructor,
          isEnrolled: true,
        },
      ],
      { session },
    );

    if (!result) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Failed to enroll in this subject !',
      );
    }

    const maxCapacity = isOfferedSubjectExists.maxCapacity;
    await OfferedSubject.findByIdAndUpdate(offeredSubject, {
      maxCapacity: maxCapacity - 1,
    });

    await session.commitTransaction();
    await session.endSession();

    return result;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};
const updateEnrolledSubjectMarksIntoDB = async (
  instructorId: string,
  payload: Partial<TEnrolledSubject>,
) => {
  const { semesterRegistration, offeredSubject, student, subjectMarks } =
    payload;

  const isSemesterRegistrationExists =
    await SemesterRegistration.findById(semesterRegistration);

  if (!isSemesterRegistrationExists) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found !',
    );
  }

  const isOfferedSubjectExists = await OfferedSubject.findById(offeredSubject);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered subject not found !');
  }
  const isStudentExists = await Student.findById(student);

  if (!isStudentExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found !');
  }

  const instructor = await Instructor.findOne({ id: instructorId }, { _id: 1 });

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  const isSubjectBelongToInstructor = await EnrolledSubject.findOne({
    semesterRegistration,
    offeredSubject,
    student,
    instructor: instructor._id,
  });

  if (!isSubjectBelongToInstructor) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You are forbidden! !');
  }

  const modifiedData: Record<string, unknown> = {};

  const currentSubjectMarks = isSubjectBelongToInstructor.subjectMarks;
  const mergedSubjectMarks = {
    classTest1: subjectMarks?.classTest1 ?? currentSubjectMarks.classTest1,
    midTerm: subjectMarks?.midTerm ?? currentSubjectMarks.midTerm,
    classTest2: subjectMarks?.classTest2 ?? currentSubjectMarks.classTest2,
    finalTerm: subjectMarks?.finalTerm ?? currentSubjectMarks.finalTerm,
  };

  const isAnyFinalComponentUpdated = subjectMarks?.finalTerm !== undefined;

  if (isAnyFinalComponentUpdated) {
    const { classTest1, classTest2, midTerm, finalTerm } = mergedSubjectMarks;

    const totalMarks = classTest1 + classTest2 + midTerm + finalTerm;

    const result = calculateGradeAndPoints(
      totalMarks,
      ENROLLED_SUBJECT_TOTAL_MARKS,
    );

    modifiedData.grade = result.grade;
    modifiedData.gradePoints = result.gradePoints;
    modifiedData.isCompleted = true;
  }

  if (subjectMarks && Object.keys(subjectMarks).length) {
    for (const [key, value] of Object.entries(subjectMarks)) {
      modifiedData[`subjectMarks.${key}`] = value;
    }
  }

  const result = await EnrolledSubject.findByIdAndUpdate(
    isSubjectBelongToInstructor._id,
    modifiedData,
    {
      new: true,
      runValidators: true,
    },
  );

  return result;
};

const getAllEnrolledSubjectsFromDB = async (query: Record<string, unknown>) => {
  const enrolledSubjectQuery = new QueryBuilder(
    EnrolledSubject.find()
      .select(
        ' subject student instructor subjectMarks grade gradePoints isCompleted',
      )
      .populate('academicSemester',"name year startMonth")
      .populate('subject', 'title code credits')
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
    .populate('semesterRegistration', 'academicSemester status shift startDate endDate')
    .populate('offeredSubject', 'section days startTime endTime')
    .populate('subject', 'title code credits regulation')
    .populate('instructor', 'id name designation email')
    .sort('-_id');

  return result;
};

export const EnrolledSubjectServices = {
  createEnrolledSubjectIntoDB,
  updateEnrolledSubjectMarksIntoDB,
  getAllEnrolledSubjectsFromDB,
  getMyEnrolledSubjectsFromDB,
};
