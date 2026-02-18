export const ENROLLED_SUBJECT_TOTAL_MARKS = 140;

export const calculateGradeAndPoints = (
  obtainedMarks: number,
  totalSubjectMarks: number = ENROLLED_SUBJECT_TOTAL_MARKS,
) => {
  let result = {
    grade: 'NA',
    gradePoints: 0,
  };

  if (
    totalSubjectMarks <= 0 ||
    obtainedMarks < 0 ||
    obtainedMarks > totalSubjectMarks
  ) {
    return result;
  }

  const percentage = (obtainedMarks / totalSubjectMarks) * 100;

  /**
   * Fail below 40% of total subject marks
   * 40-49 D
   * 50-59 C
   * 60-79 B
   * 80-100 A
   */
  if (percentage < 40) {
    result = {
      grade: 'F',
      gradePoints: 0.0,
    };
  } else if (percentage < 50) {
    result = {
      grade: 'D',
      gradePoints: 2.0,
    };
  } else if (percentage < 60) {
    result = {
      grade: 'C',
      gradePoints: 3.0,
    };
  } else if (percentage < 80) {
    result = {
      grade: 'B',
      gradePoints: 3.5,
    };
  } else if (percentage <= 100) {
    result = {
      grade: 'A',
      gradePoints: 4.0,
    };
  }

  return result;
};
