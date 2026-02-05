import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/CatchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { SubjectServices } from "./subject.service.js";

// Create Subject
const createSubject = catchAsync(async (req, res) => {
  const result = await SubjectServices.createSubjectIntoDB(req.body);

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Subject is created successfully',
    data: result,
  });
});

// Get All Subjects
const getAllSubjects = catchAsync(async (req, res) => {
  const result = await SubjectServices.getAllSubjectsFromDB(req.query);

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Subjects are retrieved successfully',
    data: result,
  });
});

// Get Single Subject
const getSingleSubject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubjectServices.getSingleSubjectFromDB(id);

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Subject is retrieved successfully',
    data: result,
  });
});

// Update Subject
const updateSubject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubjectServices.updateSubjectIntoDB(id, req.body);

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Subject is updated successfully',
    data: result,
  });
});

// Delete Subject
const deleteSubject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubjectServices.deleteSubjectFromDB(id);

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Subject is deleted successfully',
    data: result,
  });
});

// Assign Instructors
const assignInstructorsWithSubject = catchAsync(async (req, res) => {
  const { subjectId } = req.params;
  const { instructors } = req.body;

  const result = await SubjectServices.assignInstructorsWithSubjectIntoDB(
    subjectId,
    { instructors }
  );

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Instructors assigned successfully',
    data: result,
  });
});

// Remove Instructors
const removeInstructorsFromSubject = catchAsync(async (req, res) => {
  const { subjectId } = req.params;
  const { instructors } = req.body;

  const result = await SubjectServices.removeInstructorsFromSubjectFromDB(
    subjectId,
    { instructors }
  );

  sendResponse(res, {
    statusCode:StatusCodes.OK,
    success: true,
    message: 'Instructors removed successfully',
    data: result,
  });
});

// Export Subject Controllers
export const SubjectControllers = {
  createSubject,
  getAllSubjects,
  getSingleSubject,
  updateSubject,
  deleteSubject,
  assignInstructorsWithSubject,
  removeInstructorsFromSubject,
};
