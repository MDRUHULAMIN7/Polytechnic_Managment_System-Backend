
import { studentServices } from './student.service.js';
import sendResponse from '../../utils/sendResponse.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';




const getAllStudents = catchAsync(async (
  req,
  res
) => {
    const result = await studentServices.getAllStudentFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'all student find successfully !!',
      data: result,
    });
  
})



const getSingleStudent = catchAsync(async (
  req,
  res
) => {
    const { studentId } = req.params;

    const result = await studentServices.getSingleStudentFromDB(studentId);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'student find successfully !',
      data: result,
    });
})

export const studentControllers = {
  getAllStudents,
  getSingleStudent,
};
