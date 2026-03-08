import type { TUser } from '../user/user.interface.js';

export const NotificationLevel = ['info', 'success', 'warning', 'error'] as const;
export const NotificationKind = [
  'class-started',
  'class-completed',
  'class-cancelled',
  'attendance-marked',
  'offered-subject-assigned',
  'offered-subject-removed',
  'notice-published',
] as const;

export type TNotificationLevel = (typeof NotificationLevel)[number];
export type TNotificationKind = (typeof NotificationKind)[number];

export type TNotification = {
  recipientUserId: string;
  recipientRole: TUser['role'];
  kind: TNotificationKind;
  level: TNotificationLevel;
  title: string;
  message: string;
  actionUrl?: string;
  meta?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TNotificationCreateInput = Omit<
  TNotification,
  'isRead' | 'readAt' | 'createdAt' | 'updatedAt'
>;
