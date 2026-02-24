import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError.js";
import { SemesterRegistration } from "../semesterRegistration/semesterRegistration.model.js";
import type { TOfferedSubject } from "./OfferedSubject.interface.js";
import { AcademicInstructor } from "../academicInstructor/academicInstructor.model.js";
import { AcademicDepartment } from "../academicDepartment/academicDepartment.model.js";
import { Subject } from "../subject/subject.model.js";
import { Instructor } from "../Instructor/Instructor.model.js";
import { OfferedSubject } from "./OfferedSubject.model.js";
import { hasTimeConflict } from "./OfferedSubject.utils.js";
import QueryBuilder from "../../../builder/QueryBuilder.js";
import { Student } from "../student/student.model.js";


const createOfferedSubjectIntoDB = async (payload: TOfferedSubject) => {
  const {
    semesterRegistration,
    academicInstructor,
    academicDepartment,
    subject,
    section,
    instructor,
    days,
    startTime,
    endTime,
  } = payload;

  /**
   * Step 1: check if the semester registration id is exists!
   * Step 2: check if the academic instructor id is exists!
   * Step 3: check if the academic department id is exists!
   * Step 4: check if the Subject id is exists!
   * Step 5: check if the instructor id is exists!
   * Step 6: check if the department is belong to the  instructor
   * Step 7: check if the same offered Subject same section in same registered semester exists
   * Step 8: get the schedules of the instructor
   * Step 9: check if the instructor is available at that time. If not then throw error
   * Step 10: create the offered Subject
   */

  //check if the semester registration id is exists!
  const isSemesterRegistrationExits =
    await SemesterRegistration.findById(semesterRegistration);

  if (!isSemesterRegistrationExits) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Semester registration not found !',
    );
  }
  if (isSemesterRegistrationExits && isSemesterRegistrationExits.status === 'ENDED') {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'The Semester registration was ENDED',
    );
  }

  const academicSemester = isSemesterRegistrationExits.academicSemester;

  const isAcademicInstructorExits =
    await AcademicInstructor.findById(academicInstructor);

  if (!isAcademicInstructorExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic Instructor not found !');
  }

  const isAcademicDepartmentExits =
    await AcademicDepartment.findById(academicDepartment);

  if (!isAcademicDepartmentExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic Department not found !');
  }

  const isSubjectExits = await Subject.findById(subject);

  if (!isSubjectExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Subject not found !');
  }

  const isInstructorExits = await Instructor.findById(instructor);

  if (!isInstructorExits) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  // check if the department is belong to the  Instructor
  const isDepartmentBelongToInstructor = await AcademicDepartment.findOne({
    _id: academicDepartment,
    academicInstructor,
  });

  if (!isDepartmentBelongToInstructor) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `This ${isAcademicDepartmentExits.name} is not  belong to this ${isAcademicInstructorExits.name}`,
    );
  }

  // check if the same offered Subject same section in same registered semester exists

  const isSameOfferedSubjectExistsWithSameRegisteredSemesterWithSameSection =
    await OfferedSubject.findOne({
      semesterRegistration,
      subject,
      section,
    });

  if (isSameOfferedSubjectExistsWithSameRegisteredSemesterWithSameSection) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Offered Subject with same section is already exist!`,
    );
  }

  // get the schedules of the instructor
  const assignedSchedules = await OfferedSubject.find({
    semesterRegistration,
    instructor,
    days: { $in: days },
  }).select('days startTime endTime');

  const newSchedule = {
    days,
    startTime,
    endTime,
  };

  if (hasTimeConflict(assignedSchedules, newSchedule)) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `This Instructor is not available at that time ! Choose other time or day`,
    );
  }

  const result = await OfferedSubject.create({
    ...payload,
    academicSemester,
  });
  return result;
};

const getAllOfferedSubjectsFromDB = async (query: Record<string, unknown>) => {
  const offeredSubjectQuery = new QueryBuilder(
    OfferedSubject.find()
      .populate('academicSemester', 'name year')
      .populate('academicDepartment', 'name')
      .populate('subject', 'title')
      .populate('instructor', 'id name designation'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await offeredSubjectQuery.modelQuery;
  const meta = await offeredSubjectQuery.countTotal();
  return {
    meta,
    result,
  };
};

const getMyOfferedSubjectFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  //pagination setup

  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 10;
  const skip = (page - 1) * limit;

  const student = await Student.findOne({ id: userId });
  // find the student
  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User is not found');
  }

  // find all ongoing registrations (can exist by multiple shifts)
  const currentOngoingRegistrationSemesters = await SemesterRegistration.find({
    status: 'ONGOING',
  }).select('_id academicSemester');

  if (!currentOngoingRegistrationSemesters.length) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'There is no ongoing semester registration!',
    );
  }
  const currentOngoingRegistrationSemesterIds =
    currentOngoingRegistrationSemesters.map((registration) => registration._id);
  const currentOngoingAcademicSemesterIds =
    currentOngoingRegistrationSemesters.map((registration) =>
      registration.academicSemester,
    );

  const aggregationQuery = [
    {
      $match: {
        academicSemester: { $in: currentOngoingAcademicSemesterIds },
        academicInstructor: student.academicInstructor,
        academicDepartment: student.academicDepartment,
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subject',
        foreignField: '_id',
        as: 'subject',
      },
    },
    {
      $unwind: '$subject',
    },
    {
      $lookup: {
        from: 'enrolledsubjects',
        let: {
          currentOngoingRegistrationSemesterIds,
          currentStudent: student._id,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: [
                      '$semesterRegistration',
                      '$$currentOngoingRegistrationSemesterIds',
                    ],
                  },
                  {
                    $eq: ['$student', '$$currentStudent'],
                  },
                  {
                    $eq: ['$isEnrolled', true],
                  },
                ],
              },
            },
          },
        ],
        as: 'enrolledSubject',
      },
    },
    {
      $lookup: {
        from: 'enrolledsubjects',
        let: {
          currentStudent: student._id,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$student', '$$currentStudent'],
                  },
                  {
                    $eq: ['$isCompleted', true],
                  },
                ],
              },
            },
          },
        ],
        as: 'completedSubject',
      },
    },
    {
      $addFields: {
        completedSubjectIds: {
          $map: {
            input: '$completedSubject',
            as: 'completed',
            in: '$$completed.subject',
          },
        },
      },
    },
    {
      $addFields: {
        preRequisiteSubjectIds: {
          $map: {
            input: { $ifNull: ['$subject.preRequisiteSubjects', []] },
            as: 'preRequisiteSubject',
            in: '$$preRequisiteSubject.subject',
          },
        },
        isAlreadyEnrolled: {
          $in: [
            '$subject._id',
            {
              $map: {
                input: { $ifNull: ['$enrolledSubject', []] },
                as: 'enroll',
                in: '$$enroll.subject',
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        isPreRequisitesFulFilled: {
          $or: [
            { $eq: [{ $size: { $ifNull: ['$preRequisiteSubjectIds', []] } }, 0] },
            {
              $setIsSubset: [
                { $ifNull: ['$preRequisiteSubjectIds', []] },
                { $ifNull: ['$completedSubjectIds', []] },
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        isAlreadyEnrolled: false,
        isPreRequisitesFulFilled: true,
      },
    },
  ];

  const paginationQuery = [
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ];

  const result = await OfferedSubject.aggregate([
    ...aggregationQuery,
    ...paginationQuery,
  ]);
  const total = (await OfferedSubject.aggregate(aggregationQuery)).length;

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    result,
  };
};

const getSingleOfferedSubjectFromDB = async (id: string) => {
  const offeredSubject = await OfferedSubject.findById(id)
  .populate('semesterRegistration')
  .populate('academicSemester')
  .populate('academicInstructor')
  .populate('academicDepartment')
  .populate('subject')
  .populate('instructor');

  if (!offeredSubject) {
    throw new AppError(404, 'Offered Subject not found');
  }

  return offeredSubject;
};

const updateOfferedSubjectIntoDB = async (
  id: string,
  payload: Pick<TOfferedSubject, 'instructor' | 'days' | 'startTime' | 'endTime'>,
) => {
  /**
   * Step 1: check if the offered Subject exists
   * Step 2: check if the Instructor exists
   * Step 3: check if the semester registration status is upcoming
   * Step 4: check if the Instructor is available at that time. If not then throw error
   * Step 5: update the offered Subject
   */
  const { instructor, days, startTime, endTime } = payload;

  const isOfferedSubjectExists = await OfferedSubject.findById(id);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found !');
  }

  const isInstructorExists = await Instructor.findById(instructor);

  if (!isInstructorExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found !');
  }

  const semesterRegistration = isOfferedSubjectExists.semesterRegistration;
  // get the schedules of the faculties


  // Checking the status of the semester registration
  const semesterRegistrationStatus =
    await SemesterRegistration.findById(semesterRegistration);

  if (semesterRegistrationStatus?.status !== 'UPCOMING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `You can not update this offered Subject as it is ${semesterRegistrationStatus?.status}`,
    );
  }

  // check if the Instructor is available at that time.
  const assignedSchedules = await OfferedSubject.find({
    semesterRegistration,
    instructor,
    _id: { $ne: id },
    days: { $in: days },
  }).select('days startTime endTime');

  const newSchedule = {
    days,
    startTime,
    endTime,
  };

  if (hasTimeConflict(assignedSchedules, newSchedule)) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `This Instructor is not available at that time ! Choose other time or day`,
    );
  }

  const result = await OfferedSubject.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return result;
};

const deleteOfferedSubjectFromDB = async (id: string) => {
  /**
   * Step 1: check if the offered Subject exists
   * Step 2: check if the semester registration status is upcoming
   * Step 3: delete the offered Subject
   */
  const isOfferedSubjectExists = await OfferedSubject.findById(id);

  if (!isOfferedSubjectExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Offered Subject not found');
  }

  const semesterRegistation = isOfferedSubjectExists.semesterRegistration;

  const semesterRegistrationStatus =
    await SemesterRegistration.findById(semesterRegistation).select('status');

  if (semesterRegistrationStatus?.status !== 'UPCOMING') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Offered Subject can not update ! because the semester ${semesterRegistrationStatus}`,
    );
  }

  const result = await OfferedSubject.findByIdAndDelete(id);

  return result;
};

export const OfferedSubjectServices = {
  createOfferedSubjectIntoDB,
  getAllOfferedSubjectsFromDB,
  getMyOfferedSubjectFromDB,
  getSingleOfferedSubjectFromDB,
  deleteOfferedSubjectFromDB,
  updateOfferedSubjectIntoDB,
};
