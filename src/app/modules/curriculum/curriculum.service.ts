import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import AppError from '../../errors/AppError.js';
import { AcademicDepartment } from '../academicDepartment/academicDepartment.model.js';
import { AcademicSemester } from '../academicSemester/academicSemesterModel.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { Subject } from '../subject/subject.model.js';
import { curriculumSearchableFields } from './curriculum.constant.js';
import type {
  TCreateCurriculumPayload,
  TCurriculum,
} from './curriculum.interface.js';
import { Curriculum } from './curriculum.model.js';
import { Student } from '../student/student.model.js';
import { OfferedSubject } from '../OfferedSubject/OfferedSubject.model.js';

const creditsAreEqual = (left: number, right: number) =>
  Math.abs(left - right) < 0.0001;

const validateSemesterRegistrationForSemester = async (
  semisterRegistration: TCurriculum['semisterRegistration'],
  academicSemester: TCurriculum['academicSemester'],
) => {
  const semesterRegistration =
    await SemesterRegistration.findById(semisterRegistration).select(
      'academicSemester totalCredit status',
    );

  if (!semesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  if (semesterRegistration.academicSemester.toString() !== academicSemester.toString()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Academic semester and semester registration are not matched!',
    );
  }

  return semesterRegistration;
};

const assertCurriculumCreditMatchesRegistration = (
  curriculumCredit: number,
  semesterRegistrationTotalCredit: number,
) => {
  if (creditsAreEqual(curriculumCredit, semesterRegistrationTotalCredit)) {
    return;
  }

  throw new AppError(
    StatusCodes.BAD_REQUEST,
    `Selected subjects total credit (${curriculumCredit}) must exactly match the semester registration total credit (${semesterRegistrationTotalCredit}).`,
  );
};

const validateSubjectsAndCalculateCredit = async (
  subjects: TCurriculum['subjects'],
  regulation: TCurriculum['regulation'],
  academicDepartment: TCurriculum['academicDepartment'],
  semisterRegistration: TCurriculum['semisterRegistration'],
) => {
  if (!subjects?.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'At least one subject is required!');
  }

  const uniqueSubjectIds = [...new Set(subjects.map((subject) => subject.toString()))];

  if (uniqueSubjectIds.length !== subjects.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Duplicate subject is not allowed!');
  }

  const existingSubjects = await Subject.find({
    _id: { $in: uniqueSubjectIds },
    isDeleted: { $ne: true },
  }).select('_id credits regulation preRequisiteSubjects');

  if (existingSubjects.length !== uniqueSubjectIds.length) {
    throw new AppError(StatusCodes.NOT_FOUND, 'One or more subjects not found!');
  }

  const offeredSubjects = await OfferedSubject.find({
    academicDepartment,
    semesterRegistration: semisterRegistration,
    subject: { $in: uniqueSubjectIds },
  }).select('subject');
  const offeredSubjectIds = new Set(
    offeredSubjects.map((offeredSubject) => offeredSubject.subject.toString()),
  );

  if (offeredSubjectIds.size !== uniqueSubjectIds.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'All curriculum subjects must be selected from offered subjects for the chosen semester registration.',
    );
  }

  const hasRegulationMismatch = existingSubjects.some(
    (subject) => subject.regulation !== regulation,
  );

  if (hasRegulationMismatch) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'All subjects must belong to the same regulation!',
    );
  }

  const isSubjectAndPrerequisiteInSameCurriculum = existingSubjects.some(
    (subject) =>
      (subject?.preRequisiteSubjects || []).some(
        (preRequisiteSubject: {
          subject: { toString: () => string };
          isDeleted?: boolean;
        }) =>
          !preRequisiteSubject?.isDeleted &&
          uniqueSubjectIds.includes(preRequisiteSubject.subject.toString()),
      ),
  );

  if (isSubjectAndPrerequisiteInSameCurriculum) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'A subject and its prerequisite can not be in the same curriculum!',
    );
  }

  const calculatedCredit = existingSubjects.reduce(
    (sum, subject) => sum + subject.credits,
    0,
  );

  return calculatedCredit;
};

const createCurriculumIntoDB = async (payload: TCreateCurriculumPayload) => {
  const {
    academicDepartment,
    semisterRegistration,
    session,
    subjects,
    regulation,
  } = payload;

  const isAcademicDepartmentExists =
    await AcademicDepartment.findById(academicDepartment);
  const semesterRegistration =
    await SemesterRegistration.findById(semisterRegistration).select(
      'academicSemester status totalCredit',
    );

  if (!isAcademicDepartmentExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found!');
  }

  if (!semesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  if (!['UPCOMING', 'ONGOING'].includes(semesterRegistration.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Curriculum can be created only for UPCOMING or ONGOING semester registration! Current status is ${semesterRegistration.status}.`,
    );
  }
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

  const totalCredit = await validateSubjectsAndCalculateCredit(
    subjects,
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
      .populate('subjects'),
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
      .populate('subjects'),
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
    .populate('subjects');

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
    .populate('subjects');

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  return result;
};

const updateCurriculumIntoDB = async (
  id: string,
  payload: Partial<TCurriculum>,
) => {
  const existingCurriculum = await Curriculum.findById(id);

  if (!existingCurriculum) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Curriculum not found!');
  }

  const effectiveAcademicDepartment =
    payload.academicDepartment ?? existingCurriculum.academicDepartment;
  const effectiveAcademicSemester =
    payload.academicSemester ?? existingCurriculum.academicSemester;
  const effectiveSemisterRegistration =
    payload.semisterRegistration ?? existingCurriculum.semisterRegistration;
  const effectiveSession = payload.session ?? existingCurriculum.session;
  const effectiveRegulation = payload.regulation ?? existingCurriculum.regulation;
  const existingSubjectIds = existingCurriculum.subjects.map((subject) =>
    subject.toString(),
  );
  let effectiveSemesterRegistration = await SemesterRegistration.findById(
    effectiveSemisterRegistration,
  ).select('academicSemester totalCredit status');

  let effectiveSubjects: TCurriculum['subjects'] = existingCurriculum.subjects;

  if (payload.subjects) {
    const requestedSubjectIds = payload.subjects.map((subject) =>
      subject.toString(),
    );

    const uniqueRequestedSubjectIds = [...new Set(requestedSubjectIds)];

    if (uniqueRequestedSubjectIds.length !== requestedSubjectIds.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Duplicate subject is not allowed!');
    }

    const mergedSubjectIds = [
      ...new Set([...existingSubjectIds, ...requestedSubjectIds]),
    ];

    effectiveSubjects = mergedSubjectIds as unknown as TCurriculum['subjects'];
    payload.subjects = mergedSubjectIds as unknown as TCurriculum['subjects'];
  }

  if (payload.academicDepartment) {
    const isAcademicDepartmentExists = await AcademicDepartment.findById(
      payload.academicDepartment,
    );

    if (!isAcademicDepartmentExists) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Academic department not found!');
    }
  }

  if (payload.academicSemester) {
    const isAcademicSemesterExists = await AcademicSemester.findById(
      payload.academicSemester,
    );

    if (!isAcademicSemesterExists) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Academic semester not found!');
    }
  }

  if (payload.semisterRegistration || payload.academicSemester) {
    effectiveSemesterRegistration = await validateSemesterRegistrationForSemester(
      effectiveSemisterRegistration,
      effectiveAcademicSemester,
    );
  }

  if (!effectiveSemesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  const isDuplicateCurriculumExists = await Curriculum.findOne({
    academicDepartment: effectiveAcademicDepartment,
    academicSemester: effectiveAcademicSemester,
    session: effectiveSession,
    semisterRegistration: effectiveSemisterRegistration,
    _id: { $ne: id },
  });

  if (isDuplicateCurriculumExists) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Curriculum already exists for this department, semester, session and shift!',
    );
  }

  if (
    payload.subjects ||
    payload.regulation !== undefined ||
    payload.totalCredit !== undefined ||
    payload.semisterRegistration !== undefined
  ) {
    const calculatedCredit = await validateSubjectsAndCalculateCredit(
      effectiveSubjects,
      effectiveRegulation,
      effectiveAcademicDepartment,
      effectiveSemisterRegistration,
    );
    assertCurriculumCreditMatchesRegistration(
      calculatedCredit,
      effectiveSemesterRegistration.totalCredit,
    );
    payload.totalCredit = calculatedCredit;
  }

  const result = await Curriculum.findByIdAndUpdate(id, payload, {
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
  getSingleCurriculumFromDB,
  getSingleCurriculumForStudentFromDB,
  updateCurriculumIntoDB,
  deleteCurriculumFromDB,
};
