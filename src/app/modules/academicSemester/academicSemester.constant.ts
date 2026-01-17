import type { TAcademicSemesterCode, TAcademicSemesterName, TAcademicSemesterNameCodeMapper, TMonths } from "./academicSemester.interface.js";

export const Months: TMonths[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const AcademicSemesterNames:TAcademicSemesterName[]=["Spring","Autumn"];

export const AcademicSemesterCodes:TAcademicSemesterCode[]=['01','02'];

    export const academicSemesterNameCodeMapper:TAcademicSemesterNameCodeMapper ={
        Spring:"01",
        Autumn:"02"
    }