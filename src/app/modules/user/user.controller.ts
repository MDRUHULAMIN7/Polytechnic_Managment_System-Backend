
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
const createInstructor = catchAsync(async (req, res) => {
  const { password, instructor: instructorData } = req.body;

  const result = await userServices.createInstructorIntoDB(password, instructorData);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor is created succesfully',
    data: result,
  });
});

// const createAdmin = catchAsync(async (req, res) => {
//   const { password, admin: adminData } = req.body;

//   const result = await UserServices.createAdminIntoDB(password, adminData);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Admin is created succesfully',
//     data: result,
//   });
// });
export const userControllers = {
  createStudent,
  createInstructor
};