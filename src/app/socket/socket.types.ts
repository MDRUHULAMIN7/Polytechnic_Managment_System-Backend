import type { Socket } from 'socket.io';
import type { TUser } from '../modules/user/user.interface.js';

export const SocketEvent = {
  connected: 'realtime:connected',
  notificationCreated: 'notification:created',
  classStarted: 'class:started',
  classCompleted: 'class:completed',
  classCancelled: 'class:cancelled',
  attendanceMarked: 'attendance:marked',
} as const;

export type TSocketEvent = (typeof SocketEvent)[keyof typeof SocketEvent];
export type TSocketRole = TUser['role'];
export type TNotificationLevel = 'info' | 'success' | 'warning' | 'error';
export type TNotificationKind =
  | 'class-started'
  | 'class-completed'
  | 'class-cancelled'
  | 'attendance-marked'
  | 'offered-subject-assigned'
  | 'offered-subject-removed'
  | 'notice-published';

export type TRealtimeNotification = {
  id: string;
  kind: TNotificationKind;
  level: TNotificationLevel;
  title: string;
  message: string;
  createdAt: string;
  actionUrl?: string;
  meta?: Record<string, unknown>;
  read?: boolean;
  readAt?: string;
};

export type TSocketIdentity = {
  userId: string;
  role: TSocketRole;
  email?: string;
};

export type TSocketConnectionAck = {
  userId: string;
  role: TSocketRole;
  connectedAt: string;
};

export type TSocketWithUser = Socket & {
  data: {
    user?: TSocketIdentity;
  };
};
