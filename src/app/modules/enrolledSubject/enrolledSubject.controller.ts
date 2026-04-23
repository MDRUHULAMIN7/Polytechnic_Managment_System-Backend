import { StatusCodes } from 'http-status-codes';
import sendResponse from '../../utils/sendResponse.js';
import catchAsync from '../../utils/CatchAsync.js';
import { EnrolledSubjectServices } from './enrolledSubject.service.js';

const createEnrolledSubject = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await EnrolledSubjectServices.createEnrolledSubjectIntoDB(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Student is enrolled succesfully',
    data: result,
  });
});

const getAllEnrolledSubjects = catchAsync(async (req, res) => {
  const result = await EnrolledSubjectServices.getAllEnrolledSubjectsFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Enrolled subjects retrieved succesfully',
    data: result,
  });
});

const getMyEnrolledSubjects = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await EnrolledSubjectServices.getMyEnrolledSubjectsFromDB(
    userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My enrolled subjects retrieved succesfully',
    data: result,
  });
});

const upsertEnrolledSubjectMarks = catchAsync(async (req, res) => {
  const result = await EnrolledSubjectServices.upsertEnrolledSubjectMarksIntoDB(
    req.user.userId,
    req.user.role,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Marks updated successfully',
    data: result,
  });
});

const releaseOfferedSubjectComponent = catchAsync(async (req, res) => {
  const result =
    await EnrolledSubjectServices.releaseOfferedSubjectComponentIntoDB(
      req.user.userId,
      req.user.role,
      req.body,
    );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Assessment component released successfully',
    data: result,
  });
});

const publishOfferedSubjectFinalResult = catchAsync(async (req, res) => {
  const result = await EnrolledSubjectServices.publishOfferedSubjectFinalResultIntoDB(
    req.user.userId,
    req.user.role,
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Final result published successfully',
    data: result,
  });
});

const getOfferedSubjectMarkSheet = catchAsync(async (req, res) => {
  const result = await EnrolledSubjectServices.getOfferedSubjectMarkSheetFromDB(
    req.params.offeredSubjectId,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offered subject mark sheet retrieved successfully',
    data: result,
  });
});

export const EnrolledSubjectControllers = {
  createEnrolledSubject,
  getAllEnrolledSubjects,
  getMyEnrolledSubjects,
  upsertEnrolledSubjectMarks,
  releaseOfferedSubjectComponent,
  publishOfferedSubjectFinalResult,
  getOfferedSubjectMarkSheet,
};
