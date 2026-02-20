import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/CatchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { OfferedSubjectServices } from "./OfferedSubject.service.js";


const createOfferedSubject = catchAsync(async (req, res) => {
  const result = await OfferedSubjectServices.createOfferedSubjectIntoDB(
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offered Subject is created successfully !',
    data: result,
  });
});

const getAllOfferedSubjects = catchAsync(async (req, res) => {
  const result = await OfferedSubjectServices.getAllOfferedSubjectsFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'OfferedSubjects retrieved successfully !',
    data: result,
  });
});
const getMyOfferedSubject = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await OfferedSubjectServices.getMyOfferedSubjectFromDB(
    userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offered Subject retrieved successfully !',
    meta: result.meta,
    data: result.result,
  });
});


const getSingleOfferedSubjects = catchAsync(
  async (req, res) => {
    const { id } = req.params;
    const result = await OfferedSubjectServices.getSingleOfferedSubjectFromDB(id);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'OfferedSubject fetched successfully',
      data: result,
    });
  },
);

const updateOfferedSubject = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await OfferedSubjectServices.updateOfferedSubjectIntoDB(
    id,
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'OfferedSubject updated successfully',
    data: result,
  });
});

const deleteOfferedSubjectFromDB = catchAsync(
  async (req, res) => {
    const { id } = req.params;
    const result = await OfferedSubjectServices.deleteOfferedSubjectFromDB(id);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'OfferedSubject deleted successfully',
      data: result,
    });
  },
);

export const OfferedSubjectControllers = {
  createOfferedSubject,
  getAllOfferedSubjects,
  getMyOfferedSubject ,
  getSingleOfferedSubjects,
  updateOfferedSubject,
  deleteOfferedSubjectFromDB,
};