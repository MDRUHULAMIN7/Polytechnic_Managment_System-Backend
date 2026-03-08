import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { allowedOrigins } from '../config/cors.js';
import { socketAuthMiddleware } from './socket.middleware.js';
import {
  SocketEvent,
  type TRealtimeNotification,
  type TSocketConnectionAck,
  type TSocketRole,
  type TSocketWithUser,
} from './socket.types.js';

function userRoom(role: TSocketRole, userId: string) {
  return `user:${role}:${userId}`;
}

function roleRoom(role: TSocketRole) {
  return `role:${role}`;
}

class SocketService {
  private io: Server | null = null;

  initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60_000,
      pingInterval: 25_000,
    });

    this.io.use(socketAuthMiddleware);

    this.io.on('connection', (socket) => {
      this.handleConnection(socket as TSocketWithUser);
    });
  }

  private handleConnection(socket: TSocketWithUser) {
    const identity = socket.data.user;
    if (!identity) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(identity.role, identity.userId));
    socket.join(roleRoom(identity.role));

    const payload: TSocketConnectionAck = {
      userId: identity.userId,
      role: identity.role,
      connectedAt: new Date().toISOString(),
    };

    socket.emit(SocketEvent.connected, payload);
  }

  emitToUser(
    userId: string,
    role: TSocketRole,
    event: string,
    payload: TRealtimeNotification,
  ) {
    this.io?.to(userRoom(role, userId)).emit(event, payload);
    if (event !== SocketEvent.notificationCreated) {
      this.io?.to(userRoom(role, userId)).emit(SocketEvent.notificationCreated, payload);
    }
  }

  emitToUsers(
    recipients: Array<{ userId: string; role: TSocketRole }>,
    event: string,
    payloadFactory: (
      recipient: { userId: string; role: TSocketRole },
    ) => TRealtimeNotification,
  ) {
    const delivered = new Set<string>();

    for (const recipient of recipients) {
      const deliveryKey = `${recipient.role}:${recipient.userId}`;
      if (delivered.has(deliveryKey)) {
        continue;
      }

      delivered.add(deliveryKey);
      this.emitToUser(
        recipient.userId,
        recipient.role,
        event,
        payloadFactory(recipient),
      );
    }
  }

  emitToRoles(
    roles: TSocketRole[],
    event: string,
    payload: TRealtimeNotification,
  ) {
    for (const role of roles) {
      this.io?.to(roleRoom(role)).emit(event, payload);
      this.io?.to(roleRoom(role)).emit(SocketEvent.notificationCreated, payload);
    }
  }
}

export const socketService = new SocketService();
