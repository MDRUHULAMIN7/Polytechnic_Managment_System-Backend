import type { TAcademicSemesterCode, TAcademicSemesterName, TAcademicSemesterNameCodeMapper,  TMonths } from "./academicSemester.interface.js";

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

// Polytechnic semester names
export const AcademicSemesterNames: TAcademicSemesterName[] = [
  'First', 
  'Second', 
  'Third', 
  'Fourth', 
  'Fifth', 
  'Sixth', 
  'Seventh', 
  'Eighth'
];

// Polytechnic semester codes
export const AcademicSemesterCodes: TAcademicSemesterCode[] = [
  '01', '02', '03', '04', '05', '06', '07', '08'
];



// Name-Code mapping for Polytechnic
export const academicSemesterNameCodeMapper: TAcademicSemesterNameCodeMapper = {
  'First': '01',
  'Second': '02',
  'Third': '03',
  'Fourth': '04',
  'Fifth': '05',
  'Sixth': '06',
  'Seventh': '07',
  'Eighth': '08'
};

