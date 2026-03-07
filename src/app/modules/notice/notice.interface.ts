import type { Types } from 'mongoose';
import type {
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_STATUSES,
  NOTICE_TARGET_AUDIENCES,
} from './notice.constant.js';

export type TNoticeTargetAudience =
  (typeof NOTICE_TARGET_AUDIENCES)[number];
export type TNoticeCategory = (typeof NOTICE_CATEGORIES)[number];
export type TNoticePriority = (typeof NOTICE_PRIORITIES)[number];
export type TNoticeStatus = (typeof NOTICE_STATUSES)[number];

export type TNoticeAttachment = {
  name: string;
  url: string;
  fileType?: string;
  size?: number;
};

export type TNotice = {
  title: string;
  content: string;
  excerpt: string;
  attachments: TNoticeAttachment[];
  targetAudience: TNoticeTargetAudience;
  targetDepartments: Types.ObjectId[];
  category: TNoticeCategory;
  tags: string[];
  priority: TNoticePriority;
  priorityWeight: number;
  isPinned: boolean;
  publishedAt: Date;
  expiresAt?: Date;
  viewCount: number;
  requiresAcknowledgment: boolean;
  createdBy: string;
  updatedBy?: string;
  status: TNoticeStatus;
};

export type TNoticePayload = {
  title: string;
  content: string;
  attachments?: TNoticeAttachment[];
  targetAudience: TNoticeTargetAudience;
  targetDepartments?: string[];
  category: TNoticeCategory;
  tags?: string[];
  priority: TNoticePriority;
  isPinned?: boolean;
  publishedAt?: string;
  expiresAt?: string;
  requiresAcknowledgment?: boolean;
  status?: TNoticeStatus;
};
