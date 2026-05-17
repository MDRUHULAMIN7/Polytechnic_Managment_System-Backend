import { StatusCodes } from 'http-status-codes';
import QueryBuilder from '../../../builder/QueryBuilder.js';
import AppError from '../../errors/AppError.js';
import type { TPeriodConfig } from './periodConfig.interface.js';
import { PeriodConfig } from './periodConfig.model.js';
import { SemesterRegistration } from '../semesterRegistration/semesterRegistration.model.js';
import { ensureOnlyOneActiveConfig, normalizePayload } from './periodConfig.utils.js';

const createPeriodConfigIntoDB = async (
  payload: TPeriodConfig,
  actorId?: string,
) => {
  const normalizedPayload = normalizePayload(payload);
  await ensureOnlyOneActiveConfig(normalizedPayload.shift, normalizedPayload.isActive);

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
    .search(['label', 'shift'])
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


const getActivePeriodConfigFromDB = async (
  shift?: string,
  semesterRegistrationId?: string,
) => {
  let targetShift = shift;

  if (!targetShift && semesterRegistrationId) {
    const registration = await SemesterRegistration.findById(semesterRegistrationId).select('shift');
    if (registration) {
      targetShift = registration.shift;
    }
  }

  const query: Record<string, unknown> = { isActive: true };
  if (targetShift) {
    query.shift = targetShift;
  }

  const result = await PeriodConfig.findOne(query).sort({
    effectiveFrom: -1,
    createdAt: -1,
  });

  if (!result) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      `No active period configuration found${targetShift ? ` for ${targetShift} shift` : ''}. Please configure periods first.`,
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
  await ensureOnlyOneActiveConfig(normalizedPayload.shift, normalizedPayload.isActive, id);

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
