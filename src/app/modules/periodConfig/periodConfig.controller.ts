import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { PeriodConfigServices } from './periodConfig.service.js';

const createPeriodConfig = catchAsync(async (req, res) => {
  const result = await PeriodConfigServices.createPeriodConfigIntoDB(
    req.body,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Period configuration created successfully.',
    data: result,
  });
});

const getAllPeriodConfigs = catchAsync(async (req, res) => {
  const result = await PeriodConfigServices.getAllPeriodConfigsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Period configurations retrieved successfully.',
    meta: result.meta,
    data: result.result,
  });
});

const getSinglePeriodConfig = catchAsync(async (req, res) => {
  const result = await PeriodConfigServices.getSinglePeriodConfigFromDB(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Period configuration retrieved successfully.',
    data: result,
  });
});

const getActivePeriodConfig = catchAsync(async (req, res) => {
  const result = await PeriodConfigServices.getActivePeriodConfigFromDB();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Active period configuration retrieved successfully.',
    data: result,
  });
});

const updatePeriodConfig = catchAsync(async (req, res) => {
  const result = await PeriodConfigServices.updatePeriodConfigIntoDB(
    req.params.id,
    req.body,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Period configuration updated successfully.',
    data: result,
  });
});

export const PeriodConfigControllers = {
  createPeriodConfig,
  getAllPeriodConfigs,
  getSinglePeriodConfig,
  getActivePeriodConfig,
  updatePeriodConfig,
};
