import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError.js';
import type {
  TNotice,
  TNoticeAttachment,
  TNoticePayload,
  TNoticePriority,
  TNoticeTargetAudience,
} from './notice.interface.js';
import { Notice } from './notice.model.js';
import { NoticeReadStatus } from './noticeReadStatus.model.js';
import {
  NOTICE_DEFAULT_LIMIT,
  NOTICE_MAX_LIMIT,
  NOTICE_PRIORITY_WEIGHT,
} from './notice.constant.js';

export type TViewerRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'superAdmin'
  | null;
export type TNoticeQuery = Record<string, unknown>;
export type TNoticeRecord = Record<string, unknown>;

function toDateOrThrow(value: string | undefined, fieldName: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `${fieldName} must be a valid date.`,
    );
  }

  return date;
}

function normalizeText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildExcerpt(content: string) {
  const plainText = normalizeText(content);

  if (plainText.length <= 150) {
    return plainText;
  }

  return `${plainText.slice(0, 147).trim()}...`;
}

function sanitizeAttachments(attachments?: TNoticeAttachment[]) {
  return (attachments ?? []).map((attachment) => ({
    name: attachment.name.trim(),
    url: attachment.url.trim(),
    fileType: attachment.fileType?.trim(),
    size: attachment.size,
  }));
}

function sanitizeTags(tags?: string[]) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeTargetDepartments(targetDepartments?: string[]) {
  return (targetDepartments ?? [])
    .filter((item) => mongoose.isValidObjectId(item))
    .map((item) => new mongoose.Types.ObjectId(item));
}

function mapPriorityWeight(priority: TNoticePriority) {
  return NOTICE_PRIORITY_WEIGHT[priority];
}

function mapViewerAudience(role: TViewerRole): TNoticeTargetAudience | null {
  if (role === 'student' || role === 'instructor' || role === 'admin') {
    return role;
  }

  if (role === 'superAdmin') {
    return 'admin';
  }

  return null;
}

function isManager(role: TViewerRole) {
  return role === 'admin' || role === 'superAdmin';
}

export function buildVisibilityFilter(
  role: TViewerRole,
  query: TNoticeQuery,
  options?: {
    includeExpired?: boolean;
    allowAllForManager?: boolean;
  },
) {
  const now = new Date();
  const filter: Record<string, unknown> = {};
  const includeExpired = options?.includeExpired === true;

  if (!(options?.allowAllForManager && isManager(role))) {
    filter.status = 'published';
    filter.publishedAt = { $lte: now };

    if (!includeExpired) {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ];
    }

    const audience = mapViewerAudience(role);

    if (audience) {
      filter.targetAudience = { $in: ['public', audience] };
    } else {
      filter.targetAudience = 'public';
    }
  }

  const requestedAudience =
    typeof query.targetAudience === 'string' ? query.targetAudience.trim() : '';

  if (requestedAudience) {
    const audience = mapViewerAudience(role);
    const allowedAudience = new Set(
      isManager(role) && options?.allowAllForManager
        ? ['student', 'instructor', 'admin', 'public']
        : ['public', ...(audience ? [audience] : [])],
    );

    if (!allowedAudience.has(requestedAudience)) {
      filter._id = new mongoose.Types.ObjectId();
      return filter;
    }

    filter.targetAudience = requestedAudience;
  }

  return filter;
}

export function normalizeNoticePayload(
  payload: TNoticePayload,
  current?: Partial<TNotice>,
) {
  const normalizedTitle =
    payload.title !== undefined
      ? normalizeText(payload.title)
      : current?.title ?? '';
  const normalizedContent =
    payload.content !== undefined
      ? payload.content.trim()
      : current?.content ?? '';
  const priority = payload.priority ?? current?.priority ?? 'normal';
  const publishedAt =
    payload.publishedAt !== undefined
      ? toDateOrThrow(payload.publishedAt, 'publishedAt')
      : current?.publishedAt ?? new Date();
  const expiresAt =
    payload.expiresAt !== undefined
      ? toDateOrThrow(payload.expiresAt, 'expiresAt')
      : current?.expiresAt;

  if (publishedAt && expiresAt && expiresAt <= publishedAt) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'expiresAt must be later than publishedAt.',
    );
  }

  if (!normalizedTitle) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Title is required.');
  }

  if (!normalizedContent) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Content is required.');
  }

  return {
    title: normalizedTitle,
    content: normalizedContent,
    excerpt: buildExcerpt(normalizedContent),
    attachments:
      payload.attachments !== undefined
        ? sanitizeAttachments(payload.attachments)
        : current?.attachments ?? [],
    targetAudience: payload.targetAudience ?? current?.targetAudience ?? 'public',
    targetDepartments:
      payload.targetDepartments !== undefined
        ? normalizeTargetDepartments(payload.targetDepartments)
        : current?.targetDepartments ?? [],
    category: payload.category ?? current?.category ?? 'general',
    tags: payload.tags !== undefined ? sanitizeTags(payload.tags) : current?.tags ?? [],
    priority,
    priorityWeight: mapPriorityWeight(priority),
    isPinned: payload.isPinned ?? current?.isPinned ?? false,
    publishedAt,
    expiresAt,
    requiresAcknowledgment:
      payload.requiresAcknowledgment ??
      current?.requiresAcknowledgment ??
      false,
    status: payload.status ?? current?.status ?? 'published',
  };
}

export function normalizeListQuery(query: TNoticeQuery) {
  const normalizedQuery: Record<string, unknown> = { ...query };
  const includeExpired = String(normalizedQuery.includeExpired) === 'true';

  delete normalizedQuery.includeExpired;

  if (
    typeof normalizedQuery.search === 'string' &&
    typeof normalizedQuery.searchTerm !== 'string'
  ) {
    normalizedQuery.searchTerm = normalizedQuery.search;
  }

  delete normalizedQuery.search;

  if (typeof normalizedQuery.searchTerm === 'string') {
    normalizedQuery.searchTerm = normalizedQuery.searchTerm.trim();

    if (!normalizedQuery.searchTerm) {
      delete normalizedQuery.searchTerm;
    }
  }

  if (normalizedQuery.status === 'all') {
    delete normalizedQuery.status;
  }

  if (normalizedQuery.targetAudience === 'all') {
    delete normalizedQuery.targetAudience;
  }

  if (normalizedQuery.category === 'all') {
    delete normalizedQuery.category;
  }

  if (normalizedQuery.priority === 'all') {
    delete normalizedQuery.priority;
  }

  if (typeof normalizedQuery.targetDepartment === 'string') {
    const targetDepartment = normalizedQuery.targetDepartment.trim();

    if (mongoose.isValidObjectId(targetDepartment)) {
      normalizedQuery.targetDepartments = targetDepartment;
    }

    delete normalizedQuery.targetDepartment;
  }

  if (typeof normalizedQuery.startDate === 'string') {
    const startDate = toDateOrThrow(normalizedQuery.startDate, 'startDate');

    if (startDate) {
      normalizedQuery.publishedAt = {
        ...(normalizedQuery.publishedAt as Record<string, Date> | undefined),
        $gte: startDate,
      };
    }

    delete normalizedQuery.startDate;
  }

  if (typeof normalizedQuery.endDate === 'string') {
    const endDate = toDateOrThrow(normalizedQuery.endDate, 'endDate');

    if (endDate) {
      normalizedQuery.publishedAt = {
        ...(normalizedQuery.publishedAt as Record<string, Date> | undefined),
        $lte: endDate,
      };
    }

    delete normalizedQuery.endDate;
  }

  if (typeof normalizedQuery.limit === 'string') {
    const limit = Number(normalizedQuery.limit);
    normalizedQuery.limit = String(
      Number.isFinite(limit)
        ? Math.min(Math.max(limit, 1), NOTICE_MAX_LIMIT)
        : NOTICE_DEFAULT_LIMIT,
    );
  }

  if (
    typeof normalizedQuery.sort !== 'string' ||
    !normalizedQuery.sort.trim()
  ) {
    normalizedQuery.sort = '-isPinned,-priorityWeight,-publishedAt,-createdAt';
  } else if (normalizedQuery.sort === 'oldest') {
    normalizedQuery.sort = '-isPinned,-priorityWeight,publishedAt,createdAt';
  } else if (normalizedQuery.sort === 'latest') {
    normalizedQuery.sort = '-isPinned,-priorityWeight,-publishedAt,-createdAt';
  }

  return {
    normalizedQuery,
    includeExpired,
  };
}

function toPlainNotice(notice: unknown): TNoticeRecord {
  if (
    typeof (notice as { toObject?: () => Record<string, unknown> }).toObject ===
    'function'
  ) {
    return (notice as { toObject: () => Record<string, unknown> }).toObject();
  }

  return notice as TNoticeRecord;
}

function extractNoticeId(notice: TNoticeRecord) {
  const value = notice._id;

  if (typeof value === 'string' || value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  return null;
}

export async function attachReadState(notices: unknown[], userId?: string) {
  const plainNotices = notices.map((notice) => toPlainNotice(notice));

  if (!userId || plainNotices.length === 0) {
    return plainNotices.map((notice) => ({
      ...notice,
      isRead: false,
      isAcknowledged: false,
    }));
  }

  const noticeIds = plainNotices
    .map((notice) => extractNoticeId(notice))
    .filter(
      (
        noticeId,
      ): noticeId is string | mongoose.Types.ObjectId => noticeId !== null,
    );

  const readStatuses = await NoticeReadStatus.find({
    userId,
    notice: {
      $in: noticeIds,
    },
  }).lean();

  const readMap = new Map(
    readStatuses.map((item) => [item.notice.toString(), item]),
  );

  return plainNotices.map((notice) => {
    const state = readMap.get(String(notice._id));

    return {
      ...notice,
      isRead: Boolean(state),
      isAcknowledged: Boolean(state?.acknowledged),
    };
  });
}

export async function findNoticeForAccess(noticeId: string, role: TViewerRole) {
  const notice = await Notice.findById(noticeId).populate(
    'targetDepartments',
    'name',
  );

  if (!notice) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Notice not found.');
  }

  if (isManager(role)) {
    return notice;
  }

  const now = new Date();
  const audience = mapViewerAudience(role);

  if (notice.status !== 'published') {
    throw new AppError(StatusCodes.FORBIDDEN, 'You can not access this notice.');
  }

  if (notice.publishedAt > now) {
    throw new AppError(StatusCodes.FORBIDDEN, 'This notice is not live yet.');
  }

  if (notice.expiresAt && notice.expiresAt <= now) {
    throw new AppError(StatusCodes.FORBIDDEN, 'This notice has expired.');
  }

  if (
    notice.targetAudience !== 'public' &&
    (!audience || notice.targetAudience !== audience)
  ) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You can not access this notice.');
  }

  return notice;
}

export function assertAdminAudiencePermission(
  targetAudience: TNoticeTargetAudience,
  role: TViewerRole,
) {
  if (targetAudience === 'admin' && role !== 'superAdmin') {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only super admin can publish notices for admins.',
    );
  }
}
