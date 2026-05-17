import { StatusCodes } from "http-status-codes";
import type { TPeriodConfig, TPeriodConfigItem } from "./periodConfig.interface.js";
import AppError from "../../errors/AppError.js";
import { timeToMinutes } from "./periodConfig.constant.js";
import { PeriodConfig } from "./periodConfig.model.js";

export const normalizePeriodItems = (periods: TPeriodConfigItem[]) =>
  [...periods]
    .map((period) => ({
      ...period,
      title: period.title?.trim() || `Period ${period.periodNo}`,
      isBreak: period.isBreak ?? false,
      isActive: period.isActive ?? true,
    }))
    .sort((left, right) => left.periodNo - right.periodNo);

export const assertPeriodsAreValid = (periods: TPeriodConfigItem[]) => {
  const seen = new Set<number>();

  for (let index = 0; index < periods.length; index += 1) {
    const current = periods[index];

    if (seen.has(current.periodNo)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Period ${current.periodNo} can not be duplicated.`,
      );
    }
    seen.add(current.periodNo);

    if (timeToMinutes(current.endTime) <= timeToMinutes(current.startTime)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Period ${current.periodNo} has an invalid time range.`,
      );
    }

    if (
      timeToMinutes(current.endTime) - timeToMinutes(current.startTime) !==
      current.durationMinutes
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Period ${current.periodNo} duration does not match the selected time range.`,
      );
    }

    if (index === 0) {
      continue;
    }

    const previous = periods[index - 1];
    if (timeToMinutes(current.startTime) < timeToMinutes(previous.endTime)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Period ${current.periodNo} overlaps with period ${previous.periodNo}.`,
      );
    }
  }
};

export const normalizePayload = (payload: TPeriodConfig) => {
  const label = payload.label.trim();

  if (!label) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Period configuration label is required.');
  }

  const periods = normalizePeriodItems(payload.periods);
  assertPeriodsAreValid(periods);

  return {
    ...payload,
    label,
    periods,
    isActive: payload.isActive ?? false,
  };
};

export const ensureOnlyOneActiveConfig = async (
  shift: string,
  isActive: boolean | undefined,
  excludeId?: string,
) => {
  if (!isActive) {
    return;
  }

  await PeriodConfig.updateMany(
    {
      shift,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    },
    { $set: { isActive: false } },
  );
};