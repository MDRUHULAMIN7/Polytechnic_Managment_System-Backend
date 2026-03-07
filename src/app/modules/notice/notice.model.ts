import mongoose, { Schema } from 'mongoose';
import type { TNotice } from './notice.interface.js';
import {
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_STATUSES,
  NOTICE_TARGET_AUDIENCES,
} from './notice.constant.js';

const attachmentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const noticeSchema = new Schema<TNotice>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    excerpt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    targetAudience: {
      type: String,
      enum: NOTICE_TARGET_AUDIENCES,
      required: true,
    },
    targetDepartments: {
      type: [Schema.Types.ObjectId],
      ref: 'AcademicDepartment',
      default: [],
    },
    category: {
      type: String,
      enum: NOTICE_CATEGORIES,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    priority: {
      type: String,
      enum: NOTICE_PRIORITIES,
      default: 'normal',
    },
    priorityWeight: {
      type: Number,
      required: true,
      default: 0,
      select: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    requiresAcknowledgment: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: NOTICE_STATUSES,
      default: 'published',
    },
  },
  {
    timestamps: true,
  },
);

noticeSchema.index({ status: 1, publishedAt: -1 });
noticeSchema.index({ targetAudience: 1, status: 1, publishedAt: -1 });
noticeSchema.index({ category: 1, status: 1 });
noticeSchema.index({ isPinned: -1, priorityWeight: -1, publishedAt: -1 });
noticeSchema.index({ expiresAt: 1 });
noticeSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

export const Notice = mongoose.model<TNotice>('Notice', noticeSchema);
