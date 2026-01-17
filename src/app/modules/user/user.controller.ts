
import { userServices } from './user.service.js';
import sendResponse from '../../utils/sendResponse.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';



const createStudent = catchAsync(async (req, res) => {
 
    //get user req and data
    const {password , student} = req.body;


      //will call service  fun to send this data
    const result = await userServices.createStudentIntoDB(password,student);

    sendResponse(res,{
      statusCode:StatusCodes.OK,
       success: true,
       message: 'student is created successfully !',
       data:result
    })
});

export const userControllers = {
  createStudent,
};