import { StatusCodes } from "http-status-codes";
import { SemesterRegistration } from "../semesterRegistration/semesterRegistration.model.js";
import type { TCurriculum } from "./curriculum.interface.js";
import AppError from "../../errors/AppError.js";
import { OfferedSubject } from "../OfferedSubject/OfferedSubject.model.js";
import type { TSubject } from "../subject/subject.interface.js";

export const creditsAreEqual = (left: number, right: number) =>
  Math.abs(left - right) < 0.0001;

export const validateSemesterRegistrationForSemester = async (
  semisterRegistration: TCurriculum['semisterRegistration'],
  academicSemester?: TCurriculum['academicSemester'],
) => {
  const semesterRegistration =
    await SemesterRegistration.findById(semisterRegistration).select(
      'academicSemester totalCredit status',
    );

  if (!semesterRegistration) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Semester registration not found!');
  }

  if (!['UPCOMING', 'ONGOING'].includes(semesterRegistration.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Curriculum can be created/updated only for UPCOMING or ONGOING semester registration! Current status is ${semesterRegistration.status}.`,
    );
  }

  if (
    academicSemester &&
    semesterRegistration.academicSemester.toString() !== academicSemester.toString()
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Academic semester and semester registration are not matched!',
    );
  }

  return semesterRegistration;
};

export const assertCurriculumCreditMatchesRegistration = (
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

export const validateOfferedSubjectsAndCalculateCredit = async (
  offeredSubjects: TCurriculum['offeredSubjects'],
  regulation: TCurriculum['regulation'],
  academicDepartment: TCurriculum['academicDepartment'],
  semisterRegistration: TCurriculum['semisterRegistration'],
) => {
  if (!offeredSubjects?.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'At least one subject is required!');
  }

  const uniqueOfferedSubjectIds = [...new Set(offeredSubjects.map((id) => id.toString()))];

  if (uniqueOfferedSubjectIds.length !== offeredSubjects.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Duplicate offered subject is not allowed!');
  }

  const existingOfferedSubjects = await OfferedSubject.find({
    _id: { $in: uniqueOfferedSubjectIds },
    academicDepartment,
    semesterRegistration: semisterRegistration,
  }).populate('subject');

  if (existingOfferedSubjects.length !== uniqueOfferedSubjectIds.length) {
    throw new AppError(StatusCodes.NOT_FOUND, 'One or more offered subjects not found for this department and registration!');
  }

  const subjectIds = existingOfferedSubjects.map((os) =>
    (os.subject as unknown as { _id: string })._id.toString(),
  );
  const subjects = existingOfferedSubjects.map(
    (os) => os.subject as unknown as TSubject,
  );

  const regulationNumber = Number(regulation);
  const hasRegulationMismatch = subjects.some(
    (subject) => Number(subject.regulation) !== regulationNumber,
  );

  if (hasRegulationMismatch) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'All subjects must belong to the same regulation!',
    );
  }

  const isSubjectAndPrerequisiteInSameCurriculum = subjects.some(
    (subject) =>
      (subject?.preRequisiteSubjects || []).some(
        (preRequisiteSubject) =>
          !preRequisiteSubject?.isDeleted &&
          subjectIds.includes(preRequisiteSubject.subject.toString()),
      ),
  );

  if (isSubjectAndPrerequisiteInSameCurriculum) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'A subject and its prerequisite can not be in the same curriculum!',
    );
  }

  const calculatedCredit = subjects.reduce(
    (sum, subject) => sum + subject.credits,
    0,
  );

  return calculatedCredit;
};