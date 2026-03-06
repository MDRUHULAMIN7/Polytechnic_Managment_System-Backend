import type { TDays } from '../OfferedSubject/OfferedSubject.interface.js';

const dayByWeekIndex: Record<number, TDays> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const getUtcDayLabel = (date: Date): TDays => {
  return dayByWeekIndex[date.getUTCDay()];
};

export const normalizeUtcDate = (value: Date | string) => {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const formatUtcDateKey = (date: Date) => {
  return normalizeUtcDate(date).toISOString().slice(0, 10);
};
