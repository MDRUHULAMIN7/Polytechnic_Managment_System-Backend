export type TMonths =
  | 'January'
  | 'February'
  | 'March'
  | 'April'
  | 'May'
  | 'June'
  | 'July'
  | 'August'
  | 'September'
  | 'October'
  | 'November'
  | 'December';
  
// Polytechnic er semester name (01 to 08)
export type TAcademicSemesterName = 
  | 'First' 
  | 'Second' 
  | 'Third' 
  | 'Fourth' 
  | 'Fifth' 
  | 'Sixth' 
  | 'Seventh' 
  | 'Eighth';

// Polytechnic er semester code (01 to 08)
export type TAcademicSemesterCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';

export type TAcademicSemester = {
  name: TAcademicSemesterName;
  code: TAcademicSemesterCode;
  year: string;
  startMonth: TMonths;
  endMonth: TMonths;
};
export type TAcademicSemesterNameCodeMapper = {
  [key: string]: string;
};
