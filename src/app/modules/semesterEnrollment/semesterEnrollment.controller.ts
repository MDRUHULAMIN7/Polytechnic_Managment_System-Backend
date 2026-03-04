import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { SemesterEnrollmentServices } from './semesterEnrollment.service.js';

const createSemesterEnrollment = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await SemesterEnrollmentServices.createSemesterEnrollmentIntoDB(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester enrollment created and subjects auto enrolled successfully',
    data: result,
  });
});

const getMySemesterEnrollments = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await SemesterEnrollmentServices.getMySemesterEnrollmentsFromDB(
    userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My semester enrollments retrieved successfully',
    data: result,
  });
});

const getSingleSemesterEnrollment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role, userId } = req.user;
  const result = await SemesterEnrollmentServices.getSingleSemesterEnrollmentFromDB(
    id,
    role,
    userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester enrollment retrieved successfully',
    data: result,
  });
});

const getAllSemesterEnrollments = catchAsync(async (req, res) => {
  const { role, userId } = req.user;

  const result =
    role === 'student'
      ? await SemesterEnrollmentServices.getSemesterEnrollmentsForStudentFromDB(
          userId,
          req.query,
        )
      : await SemesterEnrollmentServices.getAllSemesterEnrollmentsFromDB(
          req.query,
        );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester enrollments retrieved successfully',
    data: result,
  });
});

export const SemesterEnrollmentControllers = {
  createSemesterEnrollment,
  getMySemesterEnrollments,
  getSingleSemesterEnrollment,
  getAllSemesterEnrollments,
};
