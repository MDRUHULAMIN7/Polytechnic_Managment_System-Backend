import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { ClassSessionServices } from './classSession.service.js';

const syncClassSessions = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.syncClassSessionsIntoDB(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Class sessions synchronized successfully',
    data: result,
  });
});

const getAllClassSessions = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getAllClassSessionsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Class sessions retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getInstructorClassSessions = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getInstructorClassSessionsFromDB(
    req.user.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor class sessions retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getStudentClassSessions = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getStudentClassSessionsFromDB(
    req.user.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Student class sessions retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getInstructorClassSessionDetails = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getInstructorClassSessionDetailsFromDB(
    req.params.id,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor class details retrieved successfully',
    data: result,
  });
});

const startClassSession = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.startClassSessionIntoDB(
    req.params.id,
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Class started successfully',
    data: result,
  });
});

const getStudentClassSessionDetails = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getStudentClassSessionDetailsFromDB(
    req.params.id,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Student class details retrieved successfully',
    data: result,
  });
});

const getSingleClassSession = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getSingleClassSessionFromDB(
    req.params.id,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Class session retrieved successfully',
    data: result,
  });
});

const getRoleDashboardSummary = catchAsync(async (req, res) => {
  const result = await ClassSessionServices.getRoleDashboardSummaryFromDB(
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Dashboard summary retrieved successfully',
    data: result,
  });
});

export const ClassSessionControllers = {
  syncClassSessions,
  getAllClassSessions,
  getInstructorClassSessions,
  getStudentClassSessions,
  getInstructorClassSessionDetails,
  startClassSession,
  getStudentClassSessionDetails,
  getSingleClassSession,
  getRoleDashboardSummary,
};
