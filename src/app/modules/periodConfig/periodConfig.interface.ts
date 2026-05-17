export type TPeriodConfigShift = 'MORNING' | 'DAY';

export type TPeriodConfigItem = {
  periodNo: number;
  title?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isBreak?: boolean;
  isActive?: boolean;
};

export type TPeriodConfig = {
  label: string;
  shift: TPeriodConfigShift;
  effectiveFrom: Date;
  isActive?: boolean;
  periods: TPeriodConfigItem[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
