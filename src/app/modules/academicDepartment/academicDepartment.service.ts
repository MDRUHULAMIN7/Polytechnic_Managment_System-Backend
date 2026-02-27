import { StatusCodes } from 'http-status-codes';
import type { TAcademicDepartment } from './academicDepartment.interface.js';
import { AcademicDepartment } from './academicDepartment.model.js';
import AppError from '../../errors/AppError.js';
import { AcademicInstructor } from '../academicInstructor/academicInstructor.model.js';
import QueryBuilder from '../../../builder/QueryBuilder.js';

const createAcademicDepartmentIntoDB = async (payload: TAcademicDepartment) => {
  const normalizedName = payload.name.trim();

  if (!normalizedName) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Academic department name is required!',
    );
  }

  const isAcademicInstructorExists = await AcademicInstructor.findById(
    payload.academicInstructor,
  );

  if (!isAcademicInstructorExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic instructor not found!');
  }

  const isAcademicDepartmentExists = await AcademicDepartment.findOne({
    name: normalizedName,
  });

  if (isAcademicDepartmentExists) {
    throw new AppError(StatusCodes.CONFLICT, 'This department already exists!');
  }

  const result = await AcademicDepartment.create({
    ...payload,
    name: normalizedName,
  });

  const populatedResult = await AcademicDepartment.findById(result._id).populate(
    'academicInstructor',
  );

  if (!populatedResult) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to load created department!',
    );
  }

  return populatedResult;
};

const getAllAcademicDepartmentsFromDB = async (query: Record<string, unknown>) => {
  const normalizedQuery: Record<string, unknown> = { ...query };
  const startsWith = normalizedQuery.startsWith;

  if (startsWith === 'a-m') {
    normalizedQuery.name = { $regex: '^[A-M]', $options: 'i' };
  } else if (startsWith === 'n-z') {
    normalizedQuery.name = { $regex: '^[N-Z]', $options: 'i' };
  }

  delete normalizedQuery.startsWith;

  if (normalizedQuery.academicInstructor === '') {
    delete normalizedQuery.academicInstructor;
  }

  const academicDepartmentQuery = new QueryBuilder(
    AcademicDepartment.find().populate('academicInstructor'),
    normalizedQuery,
  )
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await academicDepartmentQuery.modelQuery;
  const meta = await academicDepartmentQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSingleAcademicDepartmentFromDB = async (id: string) => {
  const result = await AcademicDepartment.findById(id).populate(
    'academicInstructor',
  );

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found!');
  }

  return result;
};

const updateAcademicDepartmentIntoDB = async (
  id: string,
  payload: Partial<TAcademicDepartment>,
) => {
  const isAcademicDepartmentExists = await AcademicDepartment.findById(id);

  if (!isAcademicDepartmentExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found!');
  }

  const updatedPayload = { ...payload };

  if (payload.name !== undefined) {
    const normalizedName = payload.name.trim();

    if (!normalizedName) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Academic department name can not be empty!',
      );
    }

    updatedPayload.name = normalizedName;

    const duplicateDepartment = await AcademicDepartment.findOne({
      name: normalizedName,
      _id: { $ne: id },
    });

    if (duplicateDepartment) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'Another department with this name already exists!',
      );
    }
  }

  if (payload.academicInstructor !== undefined) {
    const isAcademicInstructorExists = await AcademicInstructor.findById(
      payload.academicInstructor,
    );

    if (!isAcademicInstructorExists) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Academic instructor not found!');
    }
  }

  const result = await AcademicDepartment.findByIdAndUpdate(
    id,
    updatedPayload,
    {
      new: true,
      runValidators: true,
    },
  ).populate('academicInstructor');

  if (!result) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to update academic department!',
    );
  }

  return result;
};

export const AcademicDepartmentServices = {
  createAcademicDepartmentIntoDB,
  getAllAcademicDepartmentsFromDB,
  getSingleAcademicDepartmentFromDB,
  updateAcademicDepartmentIntoDB,
};
