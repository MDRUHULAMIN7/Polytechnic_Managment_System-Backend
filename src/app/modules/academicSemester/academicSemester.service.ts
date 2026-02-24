import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { academicSemesterNameCodeMapper } from './academicSemester.constant.js';
import type { TAcademicSemester } from './academicSemester.interface.js';
import { AcademicSemester } from './academicSemesterModel.js';

const createAcademicSemesterIntoDB = async (payload: TAcademicSemester) => {
  const normalizedYear = payload.year.trim();

  if (!/^\d{4}$/.test(normalizedYear)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Year must be a 4 digit number!');
  }

  if (academicSemesterNameCodeMapper[payload.name] !== payload.code) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid semester name and code mapping!');
  }

  const duplicateSemester = await AcademicSemester.findOne({
    name: payload.name,
    year: normalizedYear,
  });

  if (duplicateSemester) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `${payload.name} semester already exists in year ${normalizedYear}!`,
    );
  }

  const result = await AcademicSemester.create({
    ...payload,
    year: normalizedYear,
  });
  return result;
};

const getAllAcademicSemesterFromDB = async () => {
  const result = await AcademicSemester.find().sort('-year code');
  return result;
};

const getSingleAcademicSemesterFromDB = async (_id: string) => {
  const result = await AcademicSemester.findOne({ _id });

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic semester not found!');
  }

  return result;
};

const updateAcademicSemesterIntoDB = async (
  id: string,
  payload: Partial<TAcademicSemester>,
) => {
  const existingSemester = await AcademicSemester.findById(id);

  if (!existingSemester) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic semester not found!');
  }

  const updatedPayload = { ...payload };

  if (payload.year !== undefined) {
    const normalizedYear = payload.year.trim();

    if (!/^\d{4}$/.test(normalizedYear)) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Year must be a 4 digit number!');
    }

    updatedPayload.year = normalizedYear;
  }

  const effectiveName = payload.name ?? existingSemester.name;
  const effectiveCode = payload.code ?? existingSemester.code;

  if (academicSemesterNameCodeMapper[effectiveName] !== effectiveCode) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Invalid semester name and code mapping!',
    );
  }

  const effectiveYear = updatedPayload.year ?? existingSemester.year;

  const duplicateSemester = await AcademicSemester.findOne({
    name: effectiveName,
    year: effectiveYear,
    _id: { $ne: id },
  });

  if (duplicateSemester) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `${effectiveName} semester already exists in year ${effectiveYear}!`,
    );
  }

  const result = await AcademicSemester.findOneAndUpdate({ _id: id }, updatedPayload, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to update academic semester!',
    );
  }

  return result;
};

export const AcademicSemesterServices = {
  createAcademicSemesterIntoDB,
  getAllAcademicSemesterFromDB,
  getSingleAcademicSemesterFromDB,
  updateAcademicSemesterIntoDB,
};
