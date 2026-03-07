import express from 'express';
import auth from '../../middleware/auth.js';
import optionalAuth from '../../middleware/optionalAuth.js';
import validateRequest from '../../middleware/validateRequest.js';
import { USER_ROLE } from '../user/user.constant.js';
import { NoticeControllers } from './notice.controller.js';
import { NoticeValidation } from './notice.validation.js';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(NoticeValidation.createNoticeValidationSchema),
  NoticeControllers.createNotice,
);

router.get(
  '/manage',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  NoticeControllers.getManagedNotices,
);

router.get('/latest', optionalAuth(), NoticeControllers.getLatestNotices);

router.get(
  '/unread-count',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NoticeControllers.getUnreadCount,
);

router.get('/', optionalAuth(), NoticeControllers.getVisibleNotices);

router.post(
  '/:noticeId/read',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NoticeControllers.markNoticeAsRead,
);

router.post(
  '/:noticeId/acknowledge',
  auth(
    USER_ROLE.admin,
    USER_ROLE.superAdmin,
    USER_ROLE.instructor,
    USER_ROLE.student,
  ),
  NoticeControllers.acknowledgeNotice,
);

router.patch(
  '/:noticeId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(NoticeValidation.updateNoticeValidationSchema),
  NoticeControllers.updateNotice,
);

router.delete(
  '/:noticeId',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  NoticeControllers.deleteNotice,
);

router.get('/:noticeId', optionalAuth(), NoticeControllers.getSingleNotice);

export const NoticeRoutes = router;
