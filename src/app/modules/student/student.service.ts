
import mongoose from 'mongoose';
import type { TStudent } from './student.interface.js';
import { Student } from './student.model.js';
import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import { User } from '../user/user.model.js';


const getAllStudentFromDB = async()=>{
    const result = await Student.find().populate({
        path:'academicDepartment',
        populate:{
           path:'academicInstructor',  
        }
    }).populate('admissionSemester');
    return result;
}



const getSingleStudentFromDB = async(id:string)=>{
    const result = await Student.findOne({id}).populate({
        path:'academicDepartment',
        populate:{
           path:'academicInstructor',  
        }
    }).populate('admissionSemester');
    return result;
}


const updateStudentIntoDB = async (id: string, payload: Partial<TStudent>) => {
  const { name, guardian, localGuardian, ...remainingStudentData } = payload;

  const modifiedUpdatedData: Record<string, unknown> = {
    ...remainingStudentData,
  }; 

  /*
    guardain: {
      fatherOccupation:"Teacher"
    }

    guardian.fatherOccupation = Teacher

    name.firstName = 'Ruhul'
    name.lastName = 'Amin'
  */ 

  if (name && Object.keys(name).length) {
    for (const [key, value] of Object.entries(name)) {
      modifiedUpdatedData[`name.${key}`] = value;
    }
  }

  if (guardian && Object.keys(guardian).length) {
    for (const [key, value] of Object.entries(guardian)) {
      modifiedUpdatedData[`guardian.${key}`] = value;
    }
  }

  if (localGuardian && Object.keys(localGuardian).length) {
    for (const [key, value] of Object.entries(localGuardian)) {
      modifiedUpdatedData[`localGuardian.${key}`] = value;
    }
  }
           console.log(modifiedUpdatedData)
  const result = await Student.findOneAndUpdate({ id }, modifiedUpdatedData, {
    new: true,
    runValidators: true,
  });
  return result;
};


const deleteStudentFromDB = async (id: string) => {

    const student = await Student.findOneAndUpdate({id});
    if(!student){
     throw new AppError(StatusCodes.BAD_REQUEST, ' Student not Found');
    }
   
  const session = await mongoose.startSession();
 
  try {
    session.startTransaction();

    const deletedStudent = await Student.findOneAndUpdate(
      { id },
      { isDeleted: true },
      { new: true, session },
    );

    if (!deletedStudent) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to delete student');
    }

    const deletedUser = await User.findOneAndUpdate(
      { id },
      { isDeleted: true },
      { new: true, session },
    );

    if (!deletedUser) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to delete user');
    }

    await session.commitTransaction();
    await session.endSession();

    return deletedStudent;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to delete student');
  }
};

export const studentServices = {
 
  getAllStudentFromDB,
  getSingleStudentFromDB,
  updateStudentIntoDB ,
  deleteStudentFromDB
};
