
import sendResponse from '../../utils/sendResponse.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import { AcademicSemesterServices } from './academicSemester.service.js';



const createAcademicSemester = catchAsync(async (req, res) => {

      //will call service  fun to send this data
    const result = await AcademicSemesterServices.createAcademicSemesterIntoDB(req.body);

    sendResponse(res,{
      statusCode:StatusCodes.OK,
       success: true,
       message: 'Semester is created successfully !',
       data:result
    })
});

export const AcademicSemesterControllers = {
  createAcademicSemester,
};