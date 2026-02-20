import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { CurriculumServices } from './curriculum.service.js';

const createCurriculum = catchAsync(async (req, res) => {
  const result = await CurriculumServices.createCurriculumIntoDB(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum is created successfully!',
    data: result,
  });
});

const getAllCurriculums = catchAsync(async (req, res) => {
  const result = await CurriculumServices.getAllCurriculumsFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculums are retrieved successfully!',
    data: result,
  });
});

const getSingleCurriculum = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CurriculumServices.getSingleCurriculumFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum is retrieved successfully!',
    data: result,
  });
});

const updateCurriculum = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CurriculumServices.updateCurriculumIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum is updated successfully!',
    data: result,
  });
});

const deleteCurriculum = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CurriculumServices.deleteCurriculumFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum is deleted successfully!',
    data: result,
  });
});

export const CurriculumControllers = {
  createCurriculum,
  getAllCurriculums,
  getSingleCurriculum,
  updateCurriculum,
  deleteCurriculum,
};
