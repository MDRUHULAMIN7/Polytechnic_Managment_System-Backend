import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { StudentAttendanceServices } from './studentAttendance.service.js';

const submitStudentAttendance = catchAsync(async (req, res) => {
  const result = await StudentAttendanceServices.submitStudentAttendanceIntoDB(
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance submitted successfully',
    data: result,
  });
});

const updateStudentAttendance = catchAsync(async (req, res) => {
  const result = await StudentAttendanceServices.updateStudentAttendanceIntoDB(
    req.params.id,
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance updated successfully',
    data: result,
  });
});

const getClassAttendance = catchAsync(async (req, res) => {
  const result = await StudentAttendanceServices.getClassAttendanceFromDB(
    req.params.classSessionId,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Class attendance retrieved successfully',
    data: result,
  });
});

const getMyAttendanceSummary = catchAsync(async (req, res) => {
  const result = await StudentAttendanceServices.getMyAttendanceSummaryFromDB(
    req.user.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance summary retrieved successfully',
    data: result,
  });
});

export const StudentAttendanceControllers = {
  submitStudentAttendance,
  updateStudentAttendance,
  getClassAttendance,
  getMyAttendanceSummary,
};
