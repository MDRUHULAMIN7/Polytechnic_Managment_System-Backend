import { type RequestHandler} from 'express';
import { userServices } from './user.service.js';
import sendResponse from '../../utils/sendResponse.js';
import { StatusCodes } from 'http-status-codes';
// import studentZodValidationSchema from "../student/student.validation.js";

const createStudent : RequestHandler= async (req, res,next) => {
  try {
    //get user req and data
    const {password , student} = req.body;
   
    // data validation using joi
    // const { error ,value} = studentJoiValidationSchema.validate(student);

      // data validation using zod

    //  const zodParsedData = studentZodValidationSchema.parse(student)

      //will call service  fun to send this data
    const result = await userServices.createStudentIntoDB(password,student);
    // send res
    // res.status(200).json({
    //   success: true,
    //   message: 'student is created successfully !',
    //   data: result,
    // });
    
    sendResponse(res,{
      statusCode:StatusCodes.OK,
       success: true,
       message: 'student is created successfully !',
       data:result
    })
   
  } catch (error) {
   next(error)
  }
};

export const userControllers = {
  createStudent,
};