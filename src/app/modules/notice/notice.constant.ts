export const NOTICE_TARGET_AUDIENCES = [
  'student',
  'instructor',
  'admin',
  'public',
] as const;

export const NOTICE_CATEGORIES = [
  'academic',
  'exam',
  'holiday',
  'event',
  'administrative',
  'urgent',
  'general',
] as const;

export const NOTICE_PRIORITIES = ['normal', 'important', 'urgent'] as const;

export const NOTICE_STATUSES = ['draft', 'published', 'archived'] as const;

export const NOTICE_PRIORITY_WEIGHT: Record<
  (typeof NOTICE_PRIORITIES)[number],
  number
> = {
  normal: 0,
  important: 1,
  urgent: 2,
};

export const NOTICE_DEFAULT_LIMIT = 10;
export const NOTICE_MAX_LIMIT = 50;
