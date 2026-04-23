export const SubjectSearchableFields = ['title', 'prefix'] as const;

export const SubjectTypes = [
  'THEORY',
  'THEORY_PRACTICAL',
  'PRACTICAL_ONLY',
  'PROJECT',
  'INDUSTRIAL_ATTACHMENT',
] as const;

export const AssessmentBuckets = [
  'THEORY_CONTINUOUS',
  'THEORY_FINAL',
  'PRACTICAL_CONTINUOUS',
  'PRACTICAL_FINAL',
] as const;

export const AssessmentComponentTypes = [
  'class_test',
  'attendance',
  'assignment',
  'presentation',
  'teacher_assessment',
  'written_exam',
  'lab_performance',
  'lab_report',
  'viva',
  'practical_exam',
  'project_review',
  'industry_evaluation',
] as const;
