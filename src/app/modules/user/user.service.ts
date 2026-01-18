import config from "../../config/index.js";
import { AcademicSemester } from "../academicSemester/academicSemesterModel.js";
import type { TStudent } from "../student/student.interface.js";
import { Student } from "../student/student.model.js";
import type {  TUser } from "./user.interface.js";
import { User } from "./user.model.js";
import { generateStudentId } from "./user.utils.js";

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
    throw new Error('Academic semester not found');
  }

  //set manuall id 
  user.id = await generateStudentId(admissionSemester);

   //create a user
   const newUser = await User.create(user);// built in static method

   // create student 
   if(Object.keys(newUser).length){
    payload.id = newUser.id //embed  id
    payload.user = newUser._id // ref _id
    const newStudent = await Student.create(payload);

    return newStudent
   }
 
};

export const userServices = {
  createStudentIntoDB,
};