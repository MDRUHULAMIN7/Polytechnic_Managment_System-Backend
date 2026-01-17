export type Month =
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


export type AcademicSemester = {
    name : "Spring"|"Autumn",
    code:'01'|'02',
    year:Date,
    startMonth:Month,
    endMonth:Month,
}