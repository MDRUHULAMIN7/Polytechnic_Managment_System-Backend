import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import AppError from '../../errors/AppError.js';
import type { TPeriodConfig, TPeriodConfigItem } from './periodConfig.interface.js';
import { timeToMinutes } from './periodConfig.constant.js';
import { PeriodConfig } from './periodConfig.model.js';

const normalizePeriodItems = (periods: TPeriodConfigItem[]) =>
  [...periods]
    .map((period) => ({
      ...period,
      title: period.title?.trim() || `Period ${period.periodNo}`,
      isBreak: period.isBreak ?? false,
      isActive: period.isActive ?? true,
    }))
    .sort((left, right) => left.periodNo - right.periodNo);

const assertPeriodsAreValid = (periods: TPeriodConfigItem[]) => {
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

const normalizePayload = (payload: TPeriodConfig) => {
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

const ensureOnlyOneActiveConfig = async (
  isActive: boolean | undefined,
  excludeId?: string,
) => {
  if (!isActive) {
    return;
  }

  await PeriodConfig.updateMany(
    excludeId ? { _id: { $ne: excludeId } } : {},
    { $set: { isActive: false } },
  );
};

const createPeriodConfigIntoDB = async (
  payload: TPeriodConfig,
  actorId?: string,
) => {
  const normalizedPayload = normalizePayload(payload);
  await ensureOnlyOneActiveConfig(normalizedPayload.isActive);

  return PeriodConfig.create({
    ...normalizedPayload,
    createdBy: actorId,
    updatedBy: actorId,
  });
};

const getAllPeriodConfigsFromDB = async (query: Record<string, unknown>) => {
  const queryObj = { ...query };

  if (typeof queryObj.isActive === 'string') {
    if (queryObj.isActive === 'true') {
      queryObj.isActive = true;
    } else if (queryObj.isActive === 'false') {
      queryObj.isActive = false;
    } else {
      delete queryObj.isActive;
    }
  }

  const periodConfigQuery = new QueryBuilder(PeriodConfig.find(), queryObj)
    .search(['label'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await periodConfigQuery.modelQuery;
  const meta = await periodConfigQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSinglePeriodConfigFromDB = async (id: string) => {
  const result = await PeriodConfig.findById(id);

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Period configuration not found.');
  }

  return result;
};

const getActivePeriodConfigFromDB = async () => {
  const result = await PeriodConfig.findOne({ isActive: true }).sort({
    effectiveFrom: -1,
    createdAt: -1,
  });

  if (!result) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'No active period configuration found. Please configure periods first.',
    );
  }

  return result;
};

const updatePeriodConfigIntoDB = async (
  id: string,
  payload: TPeriodConfig,
  actorId?: string,
) => {
  const existing = await PeriodConfig.findById(id);

  if (!existing) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Period configuration not found.');
  }

  const normalizedPayload = normalizePayload(payload);
  await ensureOnlyOneActiveConfig(normalizedPayload.isActive, id);

  const result = await PeriodConfig.findByIdAndUpdate(
    id,
    {
      ...normalizedPayload,
      updatedBy: actorId,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!result) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to update period configuration.',
    );
  }

  return result;
};

export const PeriodConfigServices = {
  createPeriodConfigIntoDB,
  getAllPeriodConfigsFromDB,
  getSinglePeriodConfigFromDB,
  getActivePeriodConfigFromDB,
  updatePeriodConfigIntoDB,
};
