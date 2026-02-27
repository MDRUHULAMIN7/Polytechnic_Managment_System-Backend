import mongoose from 'mongoose';
import type { TStudent } from './student.interface.js';
import { Student } from './student.model.js';
import AppError from '../../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import { User } from '../user/user.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import { studentSearchableFields } from './student.constant.js';


const getAllStudentFromDB = async (query: Record<string, unknown>) => {
 
 
//   const queryObj = { ...query };

//   const studentSearchableFields = [
//     'email',
//     'name.firstName',
//     'presentAddress',
//   ];

//   //Search
//   if (queryObj.searchTerm) {
//     const searchTerm = queryObj.searchTerm as string;

//     queryObj.$or = studentSearchableFields.map(field => ({
//       [field]: { $regex: searchTerm, $options: 'i' },
//     }));
//   }

//   // Remove non-filter fields
//   const excludeFields = ['searchTerm', 'sort', 'page', 'limit','fields'];
//   excludeFields.forEach(field => delete queryObj[field]);

//   //  Base query
//   let mongooseQuery = Student.find(queryObj)
//     .populate({
//       path: 'academicDepartment',
//       populate: {
//         path: 'academicInstructor',
//       },
//     })
//     .populate('admissionSemester');

//   // Sorting -> Sort by createdAt DESC, break ties with _id DESC to ensure stable paginatio
//   const sort = (query.sort as string) || '-createdAt -_id';
//   mongooseQuery = mongooseQuery.sort(sort);

//   // Pagination
//   const page = Number(query.page) || 1;
//   const limit = Number(query.limit) || 10;
//   const skip = (page - 1) * limit;

//   mongooseQuery = mongooseQuery.skip(skip).limit(limit);

//   // Execute

//   // feilds limiting
//   let feilds = "-_v";

//   if(query.feilds){
//     feilds = (query.feilds as string).split(',').join(' ');
//   }
 
//  const result  = await mongooseQuery.select(feilds);
//   return result;
  const studentQuery = new QueryBuilder(
    Student.find()
      .populate('user', '_id id role email status createdAt updatedAt')
      .populate('admissionSemester')
      .populate({
        path: 'academicDepartment',
        populate: {
          path: 'academicInstructor',
        },
      }),
    query,
  )
    .search(studentSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await studentQuery.modelQuery;
  const meta = await studentQuery.countTotal();
  return{
    meta,
    result
  };
};




const getSingleStudentFromDB = async (id: string) => {
  const result = await Student.findOne({ id })
    .populate('user', '_id id role email status createdAt updatedAt')
    .populate({
      path: 'academicDepartment',
      populate: {
        path: 'academicInstructor',
      },
    })
    .populate('admissionSemester');
  return result;
};


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
