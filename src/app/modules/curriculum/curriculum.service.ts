import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import AppError from '../../errors/AppError.js';
import { AcademicDepartment } from '../academicDepartment/academicDepartment.model.js';
import { curriculumSearchableFields } from './curriculum.constant.js';
import type {
  TCreateCurriculumPayload,
  TCurriculum,
} from './curriculum.interface.js';
import { Curriculum } from './curriculum.model.js';
import { Student } from '../student/student.model.js';
import { Instructor } from '../Instructor/Instructor.model.js';
import { assertCurriculumCreditMatchesRegistration, validateOfferedSubjectsAndCalculateCredit, validateSemesterRegistrationForSemester } from './curriculum.utils.js';



const createCurriculumIntoDB = async (payload: TCreateCurriculumPayload) => {
  const {
    academicDepartment,
    semisterRegistration,
    session,
    offeredSubjects,
    regulation,
  } = payload;

  const isAcademicDepartmentExists =
    await AcademicDepartment.findById(academicDepartment);

  if (!isAcademicDepartmentExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found!');
  }

  const semesterRegistration = await validateSemesterRegistrationForSemester(
    semisterRegistration,
  );

  // If academicSemester was provided in payload, it was already validated against semesterRegistration.academicSemester
  // If not, we derive it from semesterRegistration
  const academicSemester = semesterRegistration.academicSemester;

  const isDuplicateCurriculumExists = await Curriculum.findOne({
    academicDepartment,
    academicSemester,
    session,
    semisterRegistration,
  });

  if (isDuplicateCurriculumExists) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Curriculum already exists for this department, semester, session and shift!',
    );
  }

  const totalCredit = await validateOfferedSubjectsAndCalculateCredit(
    offeredSubjects,
    regulation,
    academicDepartment,
    semisterRegistration,
  );
  assertCurriculumCreditMatchesRegistration(
    totalCredit,
    semesterRegistration.totalCredit,
  );

  const result = await Curriculum.create({
    ...payload,
    academicSemester,
    totalCredit,
  });
  return result;
};

const getAllCurriculumsFromDB = async (query: Record<string, unknown>) => {
  const curriculumQuery = new QueryBuilder(
    Curriculum.find()
      .populate('academicDepartment')
      .populate('academicSemester')
      .populate('semisterRegistration')
      .populate({
        path: 'offeredSubjects',
        populate: [
          { path: 'subject' },
          { path: 'instructor' },
          { path: 'scheduleBlocks.room' },
        ],
      }),
    query,
  )
    .search(curriculumSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await curriculumQuery.modelQuery;
  const meta = await curriculumQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getAllCurriculumsForStudentFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const student = await Student.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1 },
  );

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found!');
  }

  if (!student.academicDepartment) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Student academic department is missing!',
    );
  }

  const curriculumQuery = new QueryBuilder(
    Curriculum.find({ academicDepartment: student.academicDepartment })
      .populate('academicDepartment')
      .populate('academicSemester')
      .populate('semisterRegistration')
      .populate({
        path: 'offeredSubjects',
        populate: [
          { path: 'subject' },
          { path: 'instructor' },
          { path: 'scheduleBlocks.room' },
        ],
      }),
    query,
  )
    .search(curriculumSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await curriculumQuery.modelQuery;
  const meta = await curriculumQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getAllCurriculumsForInstructorFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const instructor = await Instructor.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1 },
  );

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found!');
  }

  const curriculumQuery = new QueryBuilder(
    Curriculum.find({ academicDepartment: instructor.academicDepartment })
      .populate('academicDepartment')
      .populate('academicSemester')
      .populate('semisterRegistration')
      .populate({
        path: 'offeredSubjects',
        populate: [
          { path: 'subject' },
          { path: 'instructor' },
          { path: 'scheduleBlocks.room' },
        ],
      }),
    query,
  )
    .search(curriculumSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await curriculumQuery.modelQuery;
  const meta = await curriculumQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSingleCurriculumFromDB = async (id: string) => {
  const result = await Curriculum.findById(id)
    .populate('academicDepartment')
    .populate('academicSemester')
    .populate('semisterRegistration')
    .populate({
      path: 'offeredSubjects',
      populate: [
        { path: 'subject' },
        { path: 'instructor' },
        { path: 'scheduleBlocks.room' },
      ],
    });

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  return result;
};

const getSingleCurriculumForStudentFromDB = async (
  id: string,
  userId: string,
) => {
  const student = await Student.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1 },
  );

  if (!student) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Student not found!');
  }

  if (!student.academicDepartment) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Student academic department is missing!',
    );
  }

  const result = await Curriculum.findOne({
    _id: id,
    academicDepartment: student.academicDepartment,
  })
    .populate('academicDepartment')
    .populate('academicSemester')
    .populate('semisterRegistration')
    .populate({
      path: 'offeredSubjects',
      populate: [
        { path: 'subject' },
        { path: 'instructor' },
        { path: 'scheduleBlocks.room' },
      ],
    });

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  return result;
};

const getSingleCurriculumForInstructorFromDB = async (
  id: string,
  userId: string,
) => {
  const instructor = await Instructor.findOne(
    { id: userId },
    { _id: 1, academicDepartment: 1 },
  );

  if (!instructor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Instructor not found!');
  }

  const result = await Curriculum.findOne({
    _id: id,
    academicDepartment: instructor.academicDepartment,
  })
    .populate('academicDepartment')
    .populate('academicSemester')
    .populate('semisterRegistration')
    .populate({
      path: 'offeredSubjects',
      populate: [
        { path: 'subject' },
        { path: 'instructor' },
        { path: 'scheduleBlocks.room' },
      ],
    });

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  return result;
};

const updateCurriculumIntoDB = async (
  id: string,
  payload: Partial<TCurriculum>,
) => {
  const isCurriculumExists = await Curriculum.findById(id);

  if (!isCurriculumExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  const semesterRegistration = await validateSemesterRegistrationForSemester(
    payload.semisterRegistration || isCurriculumExists.semisterRegistration,
  );

  const { offeredSubjects, regulation, ...remainingPayload } = payload;

  const modifiedUpdatedData: Record<string, unknown> = { ...remainingPayload };

  if (offeredSubjects?.length) {
    const totalCredit = await validateOfferedSubjectsAndCalculateCredit(
      offeredSubjects,
      regulation || isCurriculumExists.regulation,
      isCurriculumExists.academicDepartment,
      isCurriculumExists.semisterRegistration,
    );
    assertCurriculumCreditMatchesRegistration(
      totalCredit,
      semesterRegistration.totalCredit,
    );

    modifiedUpdatedData.offeredSubjects = offeredSubjects;
    modifiedUpdatedData.totalCredit = totalCredit;
  }

  if (regulation) {
    modifiedUpdatedData.regulation = regulation;
  }

  const result = await Curriculum.findByIdAndUpdate(id, modifiedUpdatedData, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteCurriculumFromDB = async (id: string) => {
  const isCurriculumExists = await Curriculum.findById(id);

  if (!isCurriculumExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  const result = await Curriculum.findByIdAndDelete(id);
  return result;
};

export const CurriculumServices = {
  createCurriculumIntoDB,
  getAllCurriculumsFromDB,
  getAllCurriculumsForStudentFromDB,
  getAllCurriculumsForInstructorFromDB,
  getSingleCurriculumFromDB,
  getSingleCurriculumForStudentFromDB,
  getSingleCurriculumForInstructorFromDB,
  updateCurriculumIntoDB,
  deleteCurriculumFromDB,
};
