import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { NoticeServices } from './notice.service.js';

const createNotice = catchAsync(async (req, res) => {
  const result = await NoticeServices.createNoticeIntoDB(
    req.body,
    req.user.userId,
    req.user.role ?? null,
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Notice created successfully.',
    data: result,
  });
});

const getManagedNotices = catchAsync(async (req, res) => {
  const result = await NoticeServices.getManagedNoticesFromDB(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notices retrieved successfully.',
    meta: result.meta,
    data: result.result,
  });
});

const getVisibleNotices = catchAsync(async (req, res) => {
  const result = await NoticeServices.getVisibleNoticesFromDB(
    req.query,
    req.user?.role ?? null,
    req.user?.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notices retrieved successfully.',
    meta: result.meta,
    data: result.result,
  });
});

const getLatestNotices = catchAsync(async (req, res) => {
  const limit =
    typeof req.query.limit === 'string' ? Number(req.query.limit) : 5;

  const result = await NoticeServices.getLatestNoticesFromDB(
    limit,
    req.user?.role ?? null,
    req.user?.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Latest notices retrieved successfully.',
    data: result,
  });
});

const getSingleNotice = catchAsync(async (req, res) => {
  const result = await NoticeServices.getSingleNoticeFromDB(
    req.params.noticeId,
    req.user?.role ?? null,
    req.user?.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notice retrieved successfully.',
    data: result,
  });
});

const updateNotice = catchAsync(async (req, res) => {
  const result = await NoticeServices.updateNoticeIntoDB(
    req.params.noticeId,
    req.body,
    req.user.userId,
    req.user.role ?? null,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notice updated successfully.',
    data: result,
  });
});

const deleteNotice = catchAsync(async (req, res) => {
  await NoticeServices.deleteNoticeFromDB(
    req.params.noticeId,
    req.user.userId,
    req.user.role ?? null,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notice deleted successfully.',
    data: null,
  });
});

const markNoticeAsRead = catchAsync(async (req, res) => {
  await NoticeServices.markNoticeAsReadIntoDB(
    req.params.noticeId,
    req.user.role ?? null,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notice marked as read.',
    data: null,
  });
});

const acknowledgeNotice = catchAsync(async (req, res) => {
  await NoticeServices.acknowledgeNoticeIntoDB(
    req.params.noticeId,
    req.user.role ?? null,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notice acknowledged successfully.',
    data: null,
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const result = await NoticeServices.getUnreadCountFromDB(
    req.user.role ?? null,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Unread count retrieved successfully.',
    data: result,
  });
});

export const NoticeControllers = {
  createNotice,
  getManagedNotices,
  getVisibleNotices,
  getLatestNotices,
  getSingleNotice,
  updateNotice,
  deleteNotice,
  markNoticeAsRead,
  acknowledgeNotice,
  getUnreadCount,
};
