import QueryBuilder from '../../../builder/QueryBuilder.js';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import type { TNoticePayload } from './notice.interface.js';
import { Notice } from './notice.model.js';
import { NoticeReadStatus } from './noticeReadStatus.model.js';
import {
  assertAdminAudiencePermission,
  attachReadState,
  buildVisibilityFilter,
  findNoticeForAccess,
  normalizeListQuery,
  normalizeNoticePayload,
  type TNoticeQuery,
  type TNoticeRecord,
  type TViewerRole,
} from './notice.utils.js';

type TNoticeListResult = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  result: TNoticeRecord[];
};

async function createNoticeIntoDBWithRole(
  payload: TNoticePayload,
  userId: string,
  role: TViewerRole,
) {
  const normalizedPayload = normalizeNoticePayload(payload);
  assertAdminAudiencePermission(normalizedPayload.targetAudience, role);

  const result = await Notice.create({
    ...normalizedPayload,
    createdBy: userId,
    updatedBy: userId,
  });

  const populatedResult = await Notice.findById(result._id).populate(
    'targetDepartments',
    'name',
  );

  if (!populatedResult) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to load created notice.',
    );
  }

  return populatedResult;
}

async function getManagedNoticesFromDB(query: TNoticeQuery): Promise<TNoticeListResult> {
  const { normalizedQuery, includeExpired } = normalizeListQuery(query);
  const visibilityFilter = buildVisibilityFilter('superAdmin', normalizedQuery, {
    includeExpired,
    allowAllForManager: true,
  });

  const noticeQuery = new QueryBuilder(
    Notice.find(visibilityFilter).populate('targetDepartments', 'name'),
    normalizedQuery,
  )
    .search(['title', 'content', 'excerpt'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await noticeQuery.modelQuery;
  const meta = await noticeQuery.countTotal();

  return {
    meta,
    result: await attachReadState(result),
  };
}

async function getVisibleNoticesFromDB(
  query: TNoticeQuery,
  role: TViewerRole,
  userId?: string,
): Promise<TNoticeListResult> {
  const { normalizedQuery, includeExpired } = normalizeListQuery(query);
  const visibilityFilter = buildVisibilityFilter(role, normalizedQuery, {
    includeExpired,
  });

  const noticeQuery = new QueryBuilder(
    Notice.find(visibilityFilter).populate('targetDepartments', 'name'),
    normalizedQuery,
  )
    .search(['title', 'content', 'excerpt'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await noticeQuery.modelQuery;
  const meta = await noticeQuery.countTotal();

  return {
    meta,
    result: await attachReadState(result, userId),
  };
}

async function getLatestNoticesFromDB(
  limit: number,
  role: TViewerRole,
  userId?: string,
) {
  const safeLimit = Math.min(Math.max(limit || 5, 1), 10);
  const visibilityFilter = buildVisibilityFilter(role, {}, {});

  const [pinned, latest] = await Promise.all([
    Notice.find({
      ...visibilityFilter,
      isPinned: true,
    })
      .sort('-priorityWeight -publishedAt -createdAt')
      .limit(3)
      .populate('targetDepartments', 'name'),
    Notice.find({
      ...visibilityFilter,
      isPinned: false,
    })
      .sort('-priorityWeight -publishedAt -createdAt')
      .limit(safeLimit)
      .populate('targetDepartments', 'name'),
  ]);

  return {
    pinned: await attachReadState(pinned, userId),
    latest: await attachReadState(latest, userId),
  };
}

async function getSingleNoticeFromDB(
  noticeId: string,
  role: TViewerRole,
  userId?: string,
) {
  const result = await findNoticeForAccess(noticeId, role);

  const [noticeWithState] = await attachReadState([result], userId);
  return noticeWithState;
}

async function updateNoticeIntoDB(
  noticeId: string,
  payload: Partial<TNoticePayload>,
  requesterId: string,
  role: TViewerRole,
) {
  const existingNotice = await Notice.findById(noticeId);

  if (!existingNotice) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Notice not found.');
  }

  if (role !== 'superAdmin' && existingNotice.createdBy !== requesterId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You can only update notices created by you.',
    );
  }

  const normalizedPayload = normalizeNoticePayload(
    payload as TNoticePayload,
    existingNotice,
  );
  assertAdminAudiencePermission(normalizedPayload.targetAudience, role);

  const updatedNotice = await Notice.findByIdAndUpdate(
    noticeId,
    {
      ...normalizedPayload,
      updatedBy: requesterId,
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate('targetDepartments', 'name');

  if (!updatedNotice) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to update notice.',
    );
  }

  return updatedNotice;
}

async function deleteNoticeFromDB(
  noticeId: string,
  requesterId: string,
  role: TViewerRole,
) {
  const existingNotice = await Notice.findById(noticeId);

  if (!existingNotice) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Notice not found.');
  }

  if (role !== 'superAdmin' && existingNotice.createdBy !== requesterId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You can only delete notices created by you.',
    );
  }

  await Promise.all([
    Notice.findByIdAndDelete(noticeId),
    NoticeReadStatus.deleteMany({ notice: noticeId }),
  ]);

  return null;
}

async function markNoticeAsReadIntoDB(
  noticeId: string,
  role: TViewerRole,
  userId: string,
) {
  await findNoticeForAccess(noticeId, role);

  await NoticeReadStatus.findOneAndUpdate(
    {
      notice: noticeId,
      userId,
    },
    {
      $set: {
        readAt: new Date(),
      },
      $setOnInsert: {
        acknowledged: false,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  return null;
}

async function acknowledgeNoticeIntoDB(
  noticeId: string,
  role: TViewerRole,
  userId: string,
) {
  const notice = await findNoticeForAccess(noticeId, role);

  if (!notice.requiresAcknowledgment) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'This notice does not require acknowledgment.',
    );
  }

  await NoticeReadStatus.findOneAndUpdate(
    {
      notice: noticeId,
      userId,
    },
    {
      $set: {
        readAt: new Date(),
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  return null;
}

async function getUnreadCountFromDB(role: TViewerRole, userId: string) {
  const visibilityFilter = buildVisibilityFilter(role, {}, {});
  const visibleIds = await Notice.find(visibilityFilter).distinct('_id');

  if (visibleIds.length === 0) {
    return { unreadCount: 0 };
  }

  const readIds = await NoticeReadStatus.find({
    userId,
    notice: { $in: visibleIds },
  }).distinct('notice');

  return {
    unreadCount: Math.max(visibleIds.length - readIds.length, 0),
  };
}

export const NoticeServices = {
  createNoticeIntoDB: createNoticeIntoDBWithRole,
  getManagedNoticesFromDB,
  getVisibleNoticesFromDB,
  getLatestNoticesFromDB,
  getSingleNoticeFromDB,
  updateNoticeIntoDB,
  deleteNoticeFromDB,
  markNoticeAsReadIntoDB,
  acknowledgeNoticeIntoDB,
  getUnreadCountFromDB,
};
