import { StatusCodes } from 'http-status-codes';
import { Schema, model } from 'mongoose';
import type { TAcademicDepartment } from './academicDepartment.interface.js';
import AppError from '../../errors/AppError.js';

const academicDepartmentSchema = new Schema<TAcademicDepartment>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    academicInstructor: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicInstructor',
    },
  },
  {
    timestamps: true,
  },
);

academicDepartmentSchema.pre('save', async function () {
  const isDepartmentExist = await AcademicDepartment.findOne({
    name: this.name,
  });

  if (isDepartmentExist) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'This department is already exist!',
    );
  }
});

academicDepartmentSchema.pre('findOneAndUpdate', async function () {
  const query = this.getQuery();
  const isDepartmentExist = await AcademicDepartment.findOne(query);

  if (!isDepartmentExist) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'This department does not exist! ',
    );
  }
});

export const AcademicDepartment = model<TAcademicDepartment>(
  'AcademicDepartment',
  academicDepartmentSchema,
);