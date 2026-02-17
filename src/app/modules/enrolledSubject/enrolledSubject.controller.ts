import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/sendResponse.js";
import catchAsync from "../../utils/CatchAsync.js";
import { EnrolledSubjectServices } from "./enrolledSubject.service.js";

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

const updateEnrolledSubjectMarks = catchAsync(async (req, res) => {
  const instructorId = req.user.userId;
  const result =
    await EnrolledSubjectServices.updateEnrolledSubjectMarksIntoDB(
      instructorId,
      req.body,
    );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Marks is updated succesfully',
    data: result,
  });
});

export const EnrolledSubjectControllers = {
  createEnrolledSubject,
  updateEnrolledSubjectMarks,
};
