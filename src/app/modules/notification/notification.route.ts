import express from 'express';
import auth from '../../middleware/auth.js';
import { USER_ROLE } from '../user/user.constant.js';
import { NotificationControllers } from './notification.controller.js';

const router = express.Router();

router.get(
  '/',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NotificationControllers.getMyNotifications,
);

router.get(
  '/unread-count',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NotificationControllers.getUnreadCount,
);

router.post(
  '/read-all',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NotificationControllers.markAllAsRead,
);

router.post(
  '/:notificationId/read',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NotificationControllers.markAsRead,
);

router.delete(
  '/',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NotificationControllers.clearAll,
);

export const NotificationRoutes = router;
