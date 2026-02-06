import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError.js";
import { RegistrationStatus } from "./semesterRegistration.constant.js";
import type { TSemesterRegistration } from "./semesterRegistration.interface.js";
import { SemesterRegistration } from "./semesterRegistration.model.js";
import QueryBuilder from "../../../builder/QueryBuilder.js";
import { AcademicSemester } from "../academicSemester/academicSemesterModel.js";




const createSemesterRegistrationIntoDB = async (
  payload: TSemesterRegistration,
) => {
  const { academicSemester, shift } = payload;

  // Step 1: Check if the academic semester exists
  const academicSemesterExists = await AcademicSemester.findById(academicSemester);

  if (!academicSemesterExists) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'This academic semester not found!',
    );
  }

  // Step 2: Check if this specific academicSemester + shift combination is already registered with 'UPCOMING' or 'ONGOING' status
  const isDuplicateActiveRegistration = await SemesterRegistration.findOne({
    academicSemester,
    shift,
    $or: [{ status: 'UPCOMING' }, { status: 'ONGOING' }],
  });

  if (isDuplicateActiveRegistration) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `This semester is already registered for ${shift} shift with status ${isDuplicateActiveRegistration.status}!`,
    );
  }

  // Step 3: Create the semester registration
  const result = await SemesterRegistration.create(payload);
  return result;
};


const getAllSemesterRegistrationsFromDB = async (
  query: Record<string, unknown>,
) => {
  const semesterRegistrationQuery = new QueryBuilder(
    SemesterRegistration.find().populate('academicSemester'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await semesterRegistrationQuery.modelQuery;
  return result;
};

const getSingleSemesterRegistrationsFromDB = async (id: string) => {
  const result = await SemesterRegistration.findById(id).populate('academicSemester');

  return result;
};



const updateSemesterRegistrationIntoDB = async (
  id: string,
  payload: Partial<TSemesterRegistration>,
) => {
  /**
   * Step1: Check if the requested registered semester exists
   * Step2: If the requested semester registration is 'ENDED', we will not update anything
   * Step3: If the requested semester registration is 'UPCOMING', we will let update everything.
   * Step4: If the requested semester registration is 'ONGOING', we will only allow updating status to 'ENDED'
   * Step5: Validate status transition: UPCOMING --> ONGOING --> ENDED
   */

  // Step 1: Check if the requested registered semester exists
  const existingSemesterRegistration = await SemesterRegistration.findById(id);

  if (!existingSemesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'This semester is not found!');
  }

  const currentSemesterStatus = existingSemesterRegistration?.status;
  const currentAcademicSemester = existingSemesterRegistration?.academicSemester;
  const currentShift = existingSemesterRegistration?.shift;
  const requestedStatus = payload?.status;

  // Step 2: If the current semester registration is 'ENDED', we will not update anything
  if (currentSemesterStatus === RegistrationStatus.ENDED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `This semester is already ${currentSemesterStatus}`,
    );
  }

  // Step 5: Validate status transition flow: UPCOMING --> ONGOING --> ENDED
  if (requestedStatus) {
    // Cannot skip from UPCOMING to ENDED
    if (
      currentSemesterStatus === RegistrationStatus.UPCOMING &&
      requestedStatus === RegistrationStatus.ENDED
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `You cannot directly change status from ${currentSemesterStatus} to ${requestedStatus}`,
      );
    }

    // Cannot go backward from ONGOING to UPCOMING
    if (
      currentSemesterStatus === RegistrationStatus.ONGOING &&
      requestedStatus === RegistrationStatus.UPCOMING
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `You cannot change status from ${currentSemesterStatus} to ${requestedStatus}`,
      );
    }
  }

  // Step 4: If status is 'ONGOING', only allow updating status to 'ENDED'
  if (currentSemesterStatus === RegistrationStatus.ONGOING) {
    // Check if user is trying to update anything other than status
    if (requestedStatus && requestedStatus === RegistrationStatus.ENDED) {
      // Allow ONLY status update to ENDED, no other fields
      const allowedKeys = ['status'];
      const payloadKeys = Object.keys(payload);
      
      // Check if there are any keys other than 'status' in the payload
      const hasOtherFields = payloadKeys.some(key => !allowedKeys.includes(key));
      
      if (hasOtherFields) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          `When semester is ${currentSemesterStatus}, you can only update status to ENDED without any other fields`
        );
      }
    } else {
      // If not trying to update status to ENDED, reject all updates
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `You can only update status to ENDED when semester is ${currentSemesterStatus}`
      );
    }
  }

  // Check for duplicate semester registration (academicSemester + status + shift)
  // Only check when these fields are actually being changed

  // Check 1: If academicSemester is being changed
  if (payload.academicSemester && payload.academicSemester.toString() !== currentAcademicSemester.toString()) {
    // Verify academic semester exists
    const academicSemesterExists = await AcademicSemester.findById(payload.academicSemester);
    if (!academicSemesterExists) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        'Academic semester not found!'
      );
    }

    // Check for duplicate with new academicSemester + current status + current shift
    const duplicateWithNewAcademicSemester = await SemesterRegistration.findOne({
      academicSemester: payload.academicSemester,
      status: currentSemesterStatus,
      shift: currentShift,
      _id: { $ne: id }
    });

    if (duplicateWithNewAcademicSemester) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A ${currentSemesterStatus.toLowerCase()} semester registration with ${currentShift} shift already exists for this academic semester!`
      );
    }
  }

  // Check 2: If status is being changed
  if (payload.status && payload.status !== currentSemesterStatus) {
    // Check for duplicate with current academicSemester + new status + current shift
    const duplicateWithNewStatus = await SemesterRegistration.findOne({
      academicSemester: currentAcademicSemester,
      status: payload.status,
      shift: currentShift,
      _id: { $ne: id }
    });

    if (duplicateWithNewStatus) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A semester registration with ${payload.status.toLowerCase()} status already exists for this academic semester and ${currentShift} shift!`
      );
    }
  }

  // Check 3: If shift is being changed
  if (payload.shift && payload.shift !== currentShift) {
    // Check for duplicate with current academicSemester + current status + new shift
    const duplicateWithNewShift = await SemesterRegistration.findOne({
      academicSemester: currentAcademicSemester,
      status: currentSemesterStatus,
      shift: payload.shift,
      _id: { $ne: id }
    });

    if (duplicateWithNewShift) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A ${currentSemesterStatus.toLowerCase()} semester registration with ${payload.shift} shift already exists for this academic semester!`
      );
    }
  }

  // Check 4: If both status and shift are being changed
  if (payload.status && payload.status !== currentSemesterStatus && 
      payload.shift && payload.shift !== currentShift) {
    
    const duplicateWithNewStatusAndShift = await SemesterRegistration.findOne({
      academicSemester: currentAcademicSemester,
      status: payload.status,
      shift: payload.shift,
      _id: { $ne: id }
    });

    if (duplicateWithNewStatusAndShift) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A semester registration with ${payload.status.toLowerCase()} status and ${payload.shift} shift already exists for this academic semester!`
      );
    }
  }

  // Check 5: If both academicSemester and shift are being changed
  if (payload.academicSemester && payload.academicSemester.toString() !== currentAcademicSemester.toString() &&
      payload.shift && payload.shift !== currentShift) {
    
    const duplicateWithNewAcademicSemesterAndShift = await SemesterRegistration.findOne({
      academicSemester: payload.academicSemester,
      status: currentSemesterStatus,
      shift: payload.shift,
      _id: { $ne: id }
    });

    if (duplicateWithNewAcademicSemesterAndShift) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A ${currentSemesterStatus.toLowerCase()} semester registration with ${payload.shift} shift already exists for this academic semester!`
      );
    }
  }

  // Check 6: If both academicSemester and status are being changed
  if (payload.academicSemester && payload.academicSemester.toString() !== currentAcademicSemester.toString() &&
      payload.status && payload.status !== currentSemesterStatus) {
    
    const duplicateWithNewAcademicSemesterAndStatus = await SemesterRegistration.findOne({
      academicSemester: payload.academicSemester,
      status: payload.status,
      shift: currentShift,
      _id: { $ne: id }
    });

    if (duplicateWithNewAcademicSemesterAndStatus) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A semester registration with ${payload.status.toLowerCase()} status and ${currentShift} shift already exists for this academic semester!`
      );
    }
  }

  // Check 7: If all three are being changed
  if (payload.academicSemester && payload.academicSemester.toString() !== currentAcademicSemester.toString() &&
      payload.status && payload.status !== currentSemesterStatus &&
      payload.shift && payload.shift !== currentShift) {
    
    const duplicateWithAllChanges = await SemesterRegistration.findOne({
      academicSemester: payload.academicSemester,
      status: payload.status,
      shift: payload.shift,
      _id: { $ne: id }
    });

    if (duplicateWithAllChanges) {
      throw new AppError(
        StatusCodes.CONFLICT,
        `A semester registration with this academic semester, ${payload.status.toLowerCase()} status and ${payload.shift} shift already exists!`
      );
    }
  }

  // Step 3: If status is 'UPCOMING', allow all updates

  const result = await SemesterRegistration.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

// const deleteSemesterRegistrationFromDB = async (id: string) => {
//   /** 
//   * Step1: Delete associated offered courses.
//   * Step2: Delete semester registraton when the status is 
//   'UPCOMING'.
//   **/

//   // checking if the semester registration is exist
//   const isSemesterRegistrationExists = await SemesterRegistration.findById(id);

//   if (!isSemesterRegistrationExists) {
//     throw new AppError(
//       StatusCodes.NOT_FOUND,
//       'This registered semester is not found !',
//     );
//   }

//   // checking if the status is still "UPCOMING"
//   const semesterRegistrationStatus = isSemesterRegistrationExists.status;

//   if (semesterRegistrationStatus !== 'UPCOMING') {
//     throw new AppError(
//       StatusCodes.BAD_REQUEST,
//       `You can not update as the registered semester is ${semesterRegistrationStatus}`,
//     );
//   }

//   const session = await mongoose.startSession();

//   //deleting associated offered courses

//   try {
//     session.startTransaction();

//     const deletedOfferedCourse = await OfferedCourse.deleteMany(
//       {
//         semesterRegistration: id,
//       },
//       {
//         session,
//       },
//     );

//     if (!deletedOfferedCourse) {
//       throw new AppError(
//         StatusCodes.BAD_REQUEST,
//         'Failed to delete semester registration !',
//       );
//     }

//     const deletedSemisterRegistration =
//       await SemesterRegistration.findByIdAndDelete(id, {
//         session,
//         new: true,
//       });

//     if (!deletedSemisterRegistration) {
//       throw new AppError(
//         StatusCodes.BAD_REQUEST,
//         'Failed to delete semester registration !',
//       );
//     }

//     await session.commitTransaction();
//     await session.endSession();

//     return null;
//   } catch (err: any) {
//     await session.abortTransaction();
//     await session.endSession();
//     throw new Error(err);
//   }
// };

export const SemesterRegistrationService = {
  createSemesterRegistrationIntoDB,
  getAllSemesterRegistrationsFromDB,
  getSingleSemesterRegistrationsFromDB,
  updateSemesterRegistrationIntoDB,
//   deleteSemesterRegistrationFromDB,
};