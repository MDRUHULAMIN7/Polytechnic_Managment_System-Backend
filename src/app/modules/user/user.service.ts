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
import { logger } from "../../utils/logger.js";
import { sendAccountOnboardingEmail } from "../../utils/accountOnboardingEmail.js";
import { sendImageToCloudinary } from "../../utils/sendImageToCloudinary.js";

type TEditableProfilePayload = {
  name?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  designation?: string;
  gender?: string;
  dateOfBirth?: string;
  contactNo?: string;
  emergencyContactNo?: string;
  bloodGroup?: string;
  bloogGroup?: string;
  presentAddress?: string;
  permanentAddress?: string;
  profileImg?: string;
  guardian?: {
    fatherName?: string;
    fatherOccupation?: string;
    fatherContactNo?: string;
    motherName?: string;
    motherOccupation?: string;
    motherContactNo?: string;
  };
  localGuardian?: {
    name?: string;
    occupation?: string;
    contactNo?: string;
    address?: string;
  };
};

function assignNestedFields(
  target: Record<string, unknown>,
  prefix: string,
  value?: Record<string, unknown>,
) {
  if (!value || !Object.keys(value).length) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue !== undefined) {
      target[`${prefix}.${key}`] = nestedValue;
    }
  }
}

function hasEditableValues(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

async function sendOnboardingEmailSafely(args: {
  email: string;
  userId: string;
  temporaryPassword: string;
  roleLabel: string;
  departmentName?: string;
  name?: {
    firstName: string;
    middleName?: string;
    lastName: string;
  };
}) {
  try {
    await sendAccountOnboardingEmail({
      to: args.email,
      userId: args.userId,
      temporaryPassword: args.temporaryPassword,
      roleLabel: args.roleLabel,
      departmentName: args.departmentName,
      name: args.name,
    });
  } catch (error) {
    logger.error('Account onboarding email delivery failed.', {
      deliveryEmail: args.email,
      userId: args.userId,
      roleLabel: args.roleLabel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildStudentUpdatePayload(payload: TEditableProfilePayload) {
  const updatePayload: Record<string, unknown> = {};

  assignNestedFields(updatePayload, 'name', payload.name);
  assignNestedFields(updatePayload, 'guardian', payload.guardian);
  assignNestedFields(updatePayload, 'localGuardian', payload.localGuardian);

  const directFields = [
    'gender',
    'dateOfBirth',
    'contactNo',
    'emergencyContactNo',
    'presentAddress',
    'permanentAddress',
    'profileImg',
  ] as const;

  for (const field of directFields) {
    if (payload[field] !== undefined) {
      updatePayload[field] = payload[field];
    }
  }

  const bloodGroup = payload.bloodGroup ?? payload.bloogGroup;
  if (bloodGroup !== undefined) {
    updatePayload.bloodGroup = bloodGroup;
  }

  return updatePayload;
}

function buildInstructorUpdatePayload(payload: TEditableProfilePayload) {
  const updatePayload: Record<string, unknown> = {};

  assignNestedFields(updatePayload, 'name', payload.name);

  const directFields = [
    'designation',
    'gender',
    'dateOfBirth',
    'contactNo',
    'emergencyContactNo',
    'presentAddress',
    'permanentAddress',
    'profileImg',
  ] as const;

  for (const field of directFields) {
    if (payload[field] !== undefined) {
      updatePayload[field] = payload[field];
    }
  }

  const bloodGroup = payload.bloogGroup ?? payload.bloodGroup;
  if (bloodGroup !== undefined) {
    updatePayload.bloogGroup = bloodGroup;
  }

  return updatePayload;
}

function buildAdminUpdatePayload(payload: TEditableProfilePayload) {
  const updatePayload: Record<string, unknown> = {};

  assignNestedFields(updatePayload, 'name', payload.name);

  const directFields = [
    'designation',
    'gender',
    'dateOfBirth',
    'contactNo',
    'emergencyContactNo',
    'presentAddress',
    'permanentAddress',
    'profileImg',
  ] as const;

  for (const field of directFields) {
    if (payload[field] !== undefined) {
      updatePayload[field] = payload[field];
    }
  }

  const bloodGroup = payload.bloogGroup ?? payload.bloodGroup;
  if (bloodGroup !== undefined) {
    updatePayload.bloogGroup = bloodGroup;
  }

  return updatePayload;
}

const createStudentIntoDB = async (
  passsword: string,
  payload: TStudent,
  file?: { path: string },
) => {


  //const student = new User(payload); //create instance
  //const result = await student.save(); // built in instance method
  //create a user object

  const user:Partial<TUser> = {};
  const temporaryPassword = passsword || config.default_password as string;


  //if password is not given , use default password
  user.password = temporaryPassword;

    // set student role 
  user.role = "student"
    // set student email
  user.email = payload.email;

  //find academic semester info 
  const  admissionSemester = await AcademicSemester.findById(payload.admissionSemester)

  //find academic department info 
  const  academicDepartment = await AcademicDepartment.findById(payload.academicDepartment)

       // Handle null case
  if (!admissionSemester || !academicDepartment) {
     throw new AppError(
      StatusCodes.NOT_FOUND,
      'Academic semester or Academic Department  not found!',
    );
  }
  payload.academicInstructor = academicDepartment.academicInstructor
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
      await sendOnboardingEmailSafely({
        email: payload.email,
        userId: newUser[0].id,
        temporaryPassword,
        roleLabel: 'student',
        departmentName: academicDepartment.name,
        name: payload.name,
      });
	    return newStudent  ;

  }catch(error:any){
   await session.abortTransaction();
   await session.endSession();
  throw new Error(error);
  }


 
};

const createInstructorIntoDB = async (password: string, payload: TInstructor,
  file?: { path: string },) => {
  // create a user object
  const userData: Partial<TUser> = {};
  const temporaryPassword = password || (config.default_password as string);

  //if password is not given , use deafult password
  userData.password = temporaryPassword;

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
   payload.academicInstructor = academicDepartment.academicInstructor
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    //set  generated id
    userData.id = await generateInstructorId();

    const imageName = `${userData.id}${payload?.name?.firstName}`;
    const path = file?.path;
    let secure_url: string | undefined;
    if (path) {
      //send image to cloudinary
      const uploadResult = await sendImageToCloudinary(imageName, path);
      secure_url = uploadResult.secure_url;
    }

    // create a user (transaction-1)
    const newUser = await User.create([userData], { session }); // array

    //create a Instructor
    if (!newUser.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create user');
    }
    // set id , _id as user
    payload.id = newUser[0].id;
    payload.user = newUser[0]._id; //reference _id
        if (secure_url) {
      payload.profileImg = secure_url;
    }

    // create a Instructor (transaction-2)

    const newInstructor = await Instructor.create([payload], { session });

    if (!newInstructor.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create Instructor');
    }

    await session.commitTransaction();
    await session.endSession();
    await sendOnboardingEmailSafely({
      email: payload.email,
      userId: newUser[0].id,
      temporaryPassword,
      roleLabel: 'instructor',
      departmentName: academicDepartment.name,
      name: payload.name,
    });

    return newInstructor;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const createAdminIntoDB = async (password: string, payload: TAdmin,file?: { path: string },) => {
  // create a user object
  const userData: Partial<TUser> = {};
  const temporaryPassword = password || (config.default_password as string);

  //if password is not given , use deafult password
  userData.password = temporaryPassword;

  //set admin role
  userData.role = 'admin';
        // set admin email
  userData.email = payload.email;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    //set  generated id
    userData.id = await generateAdminId();
    const imageName = `${userData.id}${payload?.name?.firstName}`;
    const path = file?.path;
    let secure_url: string | undefined;
    if (path) {
      //send image to cloudinary
      const uploadResult = await sendImageToCloudinary(imageName, path);
      secure_url = uploadResult.secure_url;
    }

    // create a user (transaction-1)
    const newUser = await User.create([userData], { session }); 
    

    //create a admin
    if (!newUser.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create admin');
    }
    // set id , _id as user
    payload.id = newUser[0].id;
    payload.user = newUser[0]._id; //reference _id
            if (secure_url) {
      payload.profileImg = secure_url;
    }

    // create a admin (transaction-2)
    const newAdmin = await Admin.create([payload], { session });

    if (!newAdmin.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create admin');
    }

    await session.commitTransaction();
    await session.endSession();
    await sendOnboardingEmailSafely({
      email: payload.email,
      userId: newUser[0].id,
      temporaryPassword,
      roleLabel: 'admin',
      name: payload.name,
    });

    return newAdmin;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const getMe = async (userId: string, role: string) => {
  let result = null;
  if (role === 'student') {
    result = await Student.findOne({ id: userId })
      .populate('user')
      .populate('admissionSemester', 'name year code startMonth endMonth')
      .populate('academicDepartment', 'name')
      .populate('academicInstructor', 'name');
  }
  if (role === 'admin') {
    result = await Admin.findOne({ id: userId }).populate('user');
  }

  if (role === 'instructor') {
    result = await Instructor.findOne({ id: userId })
      .populate('user')
      .populate('academicDepartment', 'name')
      .populate('academicInstructor', 'name');
  }

  if (role === 'superAdmin') {
    result = await User.findOne({ id: userId });
  }

  return result;
};

const updateMe = async (
  userId: string,
  role: string,
  payload: TEditableProfilePayload,
  file?: { path: string },
) => {
  if (role === 'superAdmin') {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This account does not have editable profile fields.',
    );
  }

  const nextPayload: TEditableProfilePayload = { ...payload };
  const uploadPath = file?.path;

  if (uploadPath) {
    const imageSeed = payload?.name?.firstName ?? role;
    const imageName = `${userId}${imageSeed}`;
    const uploadResult = await sendImageToCloudinary(imageName, uploadPath);
    nextPayload.profileImg = uploadResult.secure_url;
  }

  let result = null;

  if (role === 'student') {
    const updatePayload = buildStudentUpdatePayload(nextPayload);

    if (!hasEditableValues(updatePayload)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'No editable profile fields were provided.',
      );
    }

    result = await Student.findOneAndUpdate({ id: userId }, updatePayload, {
      new: true,
      runValidators: true,
    });
  }

  if (role === 'instructor') {
    const updatePayload = buildInstructorUpdatePayload(nextPayload);

    if (!hasEditableValues(updatePayload)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'No editable profile fields were provided.',
      );
    }

    result = await Instructor.findOneAndUpdate({ id: userId }, updatePayload, {
      new: true,
      runValidators: true,
    });
  }

  if (role === 'admin') {
    const updatePayload = buildAdminUpdatePayload(nextPayload);

    if (!hasEditableValues(updatePayload)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'No editable profile fields were provided.',
      );
    }

    result = await Admin.findOneAndUpdate({ id: userId }, updatePayload, {
      new: true,
      runValidators: true,
    });
  }

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Profile not found.');
  }

  return getMe(userId, role);
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
  updateMe,
  changeStatus
};
