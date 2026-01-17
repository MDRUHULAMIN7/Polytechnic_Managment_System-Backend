import sendResponse from '../../utils/sendResponse.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import { AcademicSemesterServices } from './academicSemester.service.js';

const createAcademicSemester = catchAsync(async (req, res) => {
  //will call service  fun to send this data
  const result = await AcademicSemesterServices.createAcademicSemesterIntoDB(
    req.body,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester is created successfully !',
    data: result,
  });
});

const getAllAcademicSemester = catchAsync(async(req,res)=>{
    const result = await AcademicSemesterServices.getAllAcademicSemesterFromDB()
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All Semester Find successfully !',
    data: result,
  });
});

const getSingleAcademicSemester = catchAsync(async(req,res)=>{
  const {semesterID} = req.params;
      const result = await AcademicSemesterServices.getSingleAcademicSemesterFromDB(semesterID);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester Find successfully !',
    data: result,
  });
});

const updateAcademicSemester = catchAsync(async (req, res) => {
  const { semesterID } = req.params;

  const result =
    await AcademicSemesterServices.updateAcademicSemesterIntoDB(
      semesterID,
      req.body,
    );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester updated successfully!',
    data: result,
  });
});


export const AcademicSemesterControllers = {
  createAcademicSemester,
  getAllAcademicSemester,
  getSingleAcademicSemester,
  updateAcademicSemester ,
};
