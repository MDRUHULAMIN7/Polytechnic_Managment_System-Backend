import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import { Months } from '../academicSemester/academicSemester.constant.js';
import type { TMonths } from '../academicSemester/academicSemester.interface.js';

const monthToIndexMap = new Map(Months.map((month, index) => [month, index]));

export const parseDateOrThrow = (value: Date | string, fieldName: string) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `${fieldName} must be a valid date`,
    );
  }

  return parsedDate;
};

export const getSemesterDurationWindow = (academicSemester: {
  year: string;
  startMonth: TMonths;
  endMonth: TMonths;
}) => {
  const semesterYear = Number(academicSemester.year);

  if (!Number.isInteger(semesterYear)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Academic semester year is invalid: ${academicSemester.year}`,
    );
  }

  const startMonthIndex = monthToIndexMap.get(academicSemester.startMonth);
  const endMonthIndex = monthToIndexMap.get(academicSemester.endMonth);

  if (startMonthIndex === undefined || endMonthIndex === undefined) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Academic semester month range is invalid',
    );
  }

  const endYear =
    endMonthIndex >= startMonthIndex ? semesterYear : semesterYear + 1;

  const durationStart = new Date(semesterYear, startMonthIndex, 1, 0, 0, 0, 0);
  const durationEnd = new Date(endYear, endMonthIndex + 1, 0, 23, 59, 59, 999);

  return { durationStart, durationEnd, endYear };
};

export const validateRegistrationTimelineAgainstSemester = (params: {
  academicSemester: { year: string; startMonth: TMonths; endMonth: TMonths };
  startDateValue: Date | string;
  endDateValue: Date | string;
}) => {
  const { academicSemester, startDateValue, endDateValue } = params;

  const startDate = parseDateOrThrow(startDateValue, 'startDate');
  const endDate = parseDateOrThrow(endDateValue, 'endDate');

  if (endDate <= startDate) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'End date must be later than start date',
    );
  }

  const { durationStart, durationEnd, endYear } =
    getSemesterDurationWindow(academicSemester);

  const isOutsideSemesterWindow =
    startDate < durationStart ||
    startDate > durationEnd ||
    endDate < durationStart ||
    endDate > durationEnd;

  if (isOutsideSemesterWindow) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Registration timeline must stay within ${academicSemester.startMonth} ${academicSemester.year} to ${academicSemester.endMonth} ${endYear}`,
    );
  }
};
