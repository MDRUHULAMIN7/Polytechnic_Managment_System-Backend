import config from "../../config/index.js";
import type { TStudent } from "../student/student.interface.js";
import { Student } from "../student/student.model.js";
import type {  TUser } from "./user.interface.js";
import { User } from "./user.model.js";

const createStudentIntoDB = async (passsword:string,studentData: TStudent) => {


  //const student = new User(studentData); //create instance
  //const result = await student.save(); // built in instance method
  //create a user object

  const user:Partial<TUser> = {};


  //if password is not given , use default password
  user.password = passsword || config.default_password as string;

    // set student role 
  user.role = "student"

  //set manuall id 
  user.id = "2026970002"

   //create a user
   const newUser = await User.create(user);// built in static method

   // create student 
   if(Object.keys(newUser).length){
    studentData.id = newUser.id //embed  id
    studentData.user = newUser._id // ref _id
    const newStudent = await Student.create(studentData);

    return newStudent
   }
 
};

export const userServices = {
  createStudentIntoDB,
};