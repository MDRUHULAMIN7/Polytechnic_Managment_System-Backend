import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import { AcademicInstructorServices } from './academicInstructor.service.js';
import sendResponse from '../../utils/sendResponse.js';

const createAcademicInstructor = catchAsync(async (req, res) => {
  const result = await  AcademicInstructorServices.createAcademicInstructorIntoDB(
    req.body,
  );

  sendResponse(res, {
    statusCode:  StatusCodes.OK,
    success: true,
    message: 'Academic Instructor is created succesfully',
    data: result,
  });
});

const getAllAcademicInstructors= catchAsync(async (req, res) => {
  const result = await AcademicInstructorServices.getAllAcademicFacultiesFromDB();

  sendResponse(res, {
    statusCode:  StatusCodes.OK,
    success: true,
    message: 'Academic Instructors are retrieved successfully',
    data: result,
  });
});

const getSingleAcademicInstructor = catchAsync(async (req, res) => {
  const { InstructorId} = req.params;
  const result =
    await AcademicInstructorServices.getSingleAcademicInstructorFromDB(InstructorId);

  sendResponse(res, {
    statusCode:  StatusCodes.OK,
    success: true,
    message: 'Academic Instructor is retrieved succesfully',
    data: result,
  });
});

const updateAcademicInstructor = catchAsync(async (req, res) => {
  const { InstructorId } = req.params;
  const result = await AcademicInstructorServices.updateAcademicInstructorIntoDB(
    InstructorId,
    req.body,
  );

  sendResponse(res, {
    statusCode:  StatusCodes.OK,
    success: true,
    message: 'Academic Instructoris updated succesfully',
    data: result,
  });
});

export const AcademicInstructorControllers = {
  createAcademicInstructor,
  getAllAcademicInstructors,
  getSingleAcademicInstructor,
  updateAcademicInstructor,
};