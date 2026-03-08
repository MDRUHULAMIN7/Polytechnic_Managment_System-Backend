import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { NotificationService } from './notification.service.js';

const getMyNotifications = catchAsync(async (req, res) => {
  const result = await NotificationService.getMyNotificationsFromDB(
    req.user.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notifications retrieved successfully.',
    meta: result.meta,
    data: result.result,
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const result = await NotificationService.getUnreadCountFromDB(req.user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification unread count retrieved successfully.',
    data: result,
  });
});

const markAsRead = catchAsync(async (req, res) => {
  await NotificationService.markAsReadIntoDB(req.params.notificationId, req.user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification marked as read.',
    data: null,
  });
});

const markAllAsRead = catchAsync(async (req, res) => {
  await NotificationService.markAllAsReadIntoDB(req.user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All notifications marked as read.',
    data: null,
  });
});

const clearAll = catchAsync(async (req, res) => {
  await NotificationService.clearAllIntoDB(req.user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notifications cleared successfully.',
    data: null,
  });
});

export const NotificationControllers = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearAll,
};
