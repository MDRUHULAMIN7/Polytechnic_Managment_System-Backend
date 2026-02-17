import { StatusCodes } from "http-status-codes";
import config from "../../config/index.js";
import AppError from "../../errors/AppError.js";
import { AcademicSemester } from "../academicSemester/academicSemesterModel.js";
import type { TStudent } from "../student/student.interface.js";
import { Student } from "../student/student.model.js";
import type {  TUser } from "./user.interface.js";
import { User } from "./user.model.js";
import { generateAdminId, generateInstructorId, generateStudentId } from "./user.utils.js";
import mongoose from "mongoose";
import { Instructor } from "../Instructor/Instructor.model.js";
import type { TInstructor } from "../Instructor/Instructor.interface.js";
import { AcademicDepartment } from "../academicDepartment/academicDepartment.model.js";
import { Admin } from "../admin/admin.model.js";
import type { TAdmin } from "../admin/admin.interface.js";
import { sendImageToCloudinary } from "../../utils/sendImageToCloudinary.js";

const createStudentIntoDB = async (
  passsword: string,
  payload: TStudent,
  file?: { path: string },
) => {


  //const student = new User(payload); //create instance
  //const result = await student.save(); // built in instance method
  //create a user object

  const user:Partial<TUser> = {};


  //if password is not given , use default password
  user.password = passsword || config.default_password as string;

    // set student role 
  user.role = "student"
    // set student email
  user.email = payload.email;

  //find academic semester info 
  const  admissionSemester = await AcademicSemester.findById(payload.admissionSemester)
  //find academic semester info 
  const  academicDepartment = await AcademicDepartment.findById(payload.academicDepartment)
       // Handle null case
  if (!admissionSemester || !academicDepartment) {
     throw new AppError(
      StatusCodes.NOT_FOUND,
      'Academic semester or Academic Department  not found!',
    );
  }

  const session = await mongoose.startSession()
  try{

    session.startTransaction()
//set manuall id 
  user.id = await generateStudentId(admissionSemester);
    const imageName = `${user.id}${payload?.name?.firstName}`;
    const path = file?.path;
    let secure_url: string | undefined;
    if (path) {
      //send image to cloudinary
      const uploadResult = await sendImageToCloudinary(imageName, path);
      secure_url = uploadResult.secure_url;
    }
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
    if (secure_url) {
      payload.profileImg = secure_url;
    }

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

  }catch(error:any){
   await session.abortTransaction();
   await session.endSession();
  throw new Error(error);
  }


 
};

const createInstructorIntoDB = async (password: string, payload: TInstructor) => {
  // create a user object
  const userData: Partial<TUser> = {};

  //if password is not given , use deafult password
  userData.password = password || (config.default_password as string);

  //set instructor role
  userData.role = 'instructor';
      // set instructor email
  userData.email = payload.email;

  // find academic department info
  const academicDepartment = await AcademicDepartment.findById(
    payload.academicDepartment,
  );

  if (!academicDepartment) {
    throw new AppError(400, 'Academic department not found');
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    //set  generated id
    userData.id = await generateInstructorId();

    // create a user (transaction-1)
    const newUser = await User.create([userData], { session }); // array

    //create a Instructor
    if (!newUser.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create user');
    }
    // set id , _id as user
    payload.id = newUser[0].id;
    payload.user = newUser[0]._id; //reference _id

    // create a Instructor (transaction-2)

    const newInstructor = await Instructor.create([payload], { session });

    if (!newInstructor.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create Instructor');
    }

    await session.commitTransaction();
    await session.endSession();

    return newInstructor;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const createAdminIntoDB = async (password: string, payload: TAdmin) => {
  // create a user object
  const userData: Partial<TUser> = {};

  //if password is not given , use deafult password
  userData.password = password || (config.default_password as string);

  //set admin role
  userData.role = 'admin';
        // set admin email
  userData.email = payload.email;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    //set  generated id
    userData.id = await generateAdminId();

    // create a user (transaction-1)
    const newUser = await User.create([userData], { session }); 

    //create a admin
    if (!newUser.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create admin');
    }
    // set id , _id as user
    payload.id = newUser[0].id;
    payload.user = newUser[0]._id; //reference _id

    // create a admin (transaction-2)
    const newAdmin = await Admin.create([payload], { session });

    if (!newAdmin.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create admin');
    }

    await session.commitTransaction();
    await session.endSession();

    return newAdmin;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const getMe = async (userId: string, role: string) => {
  // const decoded = verifyToken(token, config.jwt_access_secret as string);
  // const { userId, role } = decoded;

  let result = null;
  if (role === 'student') {
    result = await Student.findOne({ id: userId }).populate('user');
  }
  if (role === 'admin') {
    result = await Admin.findOne({ id: userId }).populate('user');
  }

  if (role === 'faculty') {
    result = await Instructor.findOne({ id: userId }).populate('user');
  }

  return result;
};
const changeStatus = async (id: string, payload: { status: string }) => {
  const result = await User.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return result;
};
export const userServices = {
  createStudentIntoDB,
  createInstructorIntoDB,
  createAdminIntoDB,
  getMe,
  changeStatus
};
