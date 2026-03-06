import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/CatchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { InstructorServices } from "./Instructor.service.js";


const getSingleInstructor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await InstructorServices.getSingleInstructorFromDB( id );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor is retrieved succesfully',
    data: result,
  });
});

const getAllInstructors = catchAsync(async (req, res) => {
  const result = await InstructorServices.getAllInstructorsFromDB(req.query);
   
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructors are retrieved succesfully',
    data: result,
  });
});

const getInstructorSummary = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await InstructorServices.getInstructorSummaryFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor summary is retrieved succesfully',
    data: result,
  });
});

const getAssignedSubjectsForInstructor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await InstructorServices.getAssignedSubjectsForInstructorFromDB(
    id,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Assigned subjects are retrieved succesfully',
    data: result,
  });
});

const updateInstructor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { Instructor } = req.body;
  const result = await InstructorServices.updateInstructorIntoDB( id , Instructor);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor is updated succesfully',
    data: result,
  });
});

const deleteInstructor = catchAsync(async (req, res) => {
  const {  id } = req.params;
  const result = await InstructorServices.deleteInstructorFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor is deleted succesfully',
    data: result,
  });
});

export const InstructorControllers = {
  getAllInstructors,
  getSingleInstructor,
  getInstructorSummary,
  getAssignedSubjectsForInstructor,
  deleteInstructor,
  updateInstructor,
};
