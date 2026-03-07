import mongoose, { Schema } from 'mongoose';
import type { TNoticeReadStatus } from './noticeReadStatus.interface.js';

const noticeReadStatusSchema = new Schema<TNoticeReadStatus>(
  {
    notice: {
      type: Schema.Types.ObjectId,
      ref: 'Notice',
      required: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

noticeReadStatusSchema.index({ notice: 1, userId: 1 }, { unique: true });
noticeReadStatusSchema.index({ userId: 1, readAt: -1 });
noticeReadStatusSchema.index({ notice: 1, acknowledged: 1 });

export const NoticeReadStatus = mongoose.model<TNoticeReadStatus>(
  'NoticeReadStatus',
  noticeReadStatusSchema,
);
