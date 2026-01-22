import { StatusCodes } from "http-status-codes";
import config from "../../config/index.js";
import AppError from "../../errors/AppError.js";
import { AcademicSemester } from "../academicSemester/academicSemesterModel.js";
import type { TStudent } from "../student/student.interface.js";
import { Student } from "../student/student.model.js";
import type {  TUser } from "./user.interface.js";
import { User } from "./user.model.js";
import { generateStudentId } from "./user.utils.js";
import mongoose from "mongoose";

const createStudentIntoDB = async (passsword:string,payload: TStudent) => {


  //const student = new User(payload); //create instance
  //const result = await student.save(); // built in instance method
  //create a user object

  const user:Partial<TUser> = {};


  //if password is not given , use default password
  user.password = passsword || config.default_password as string;

    // set student role 
  user.role = "student"

  //find academic semester info 
  const  admissionSemester = await AcademicSemester.findById(payload.admissionSemester)
       // Handle null case
  if (!admissionSemester) {
     throw new AppError(
      StatusCodes.NOT_FOUND,
      'Academic semester not found!',
    );
  }

  const session = await mongoose.startSession()
  try{

    session.startTransaction()
//set manuall id 
  user.id = await generateStudentId(admissionSemester);

   //create a user(transaction - 1)
   const newUser = await User.create([user],{session});// built in static method

   if(!newUser.length){
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Failed to create user !',
    );
   }
    payload.id = newUser[0].id //embed  id
    payload.user = newUser[0]._id // ref _id

    //create student (transaction -2)
    const newStudent = await Student.create([payload],{session});
       if(!newStudent.length){
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Failed to create student !',
    );
   }

   await session.commitTransaction();
   await session.endSession();
    return newStudent  ;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }catch(error){
   await session.abortTransaction();
  await session.endSession();
  }


   
 
};

export const userServices = {
  createStudentIntoDB,
};