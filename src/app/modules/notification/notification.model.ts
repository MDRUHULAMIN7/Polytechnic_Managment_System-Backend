import mongoose, { Schema } from 'mongoose';
import {
  NotificationKind,
  NotificationLevel,
  type TNotification,
} from './notification.interface.js';

const notificationSchema = new Schema<TNotification>(
  {
    recipientUserId: {
      type: String,
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['student', 'instructor', 'admin', 'superAdmin'],
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: NotificationKind,
      required: true,
      index: true,
    },
    level: {
      type: String,
      enum: NotificationLevel,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<TNotification>(
  'Notification',
  notificationSchema,
);
