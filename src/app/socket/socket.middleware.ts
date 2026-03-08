import type { Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { readBearerToken, resolveSessionUser } from '../utils/session-auth.js';
import type { TSocketWithUser } from './socket.types.js';

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const authHeader = readBearerToken(
      typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization
        : undefined,
    );
    const authPayload =
      typeof socket.handshake.auth === 'object' && socket.handshake.auth
        ? socket.handshake.auth
        : null;
    const handshakeToken =
      authPayload && typeof authPayload.accessToken === 'string'
        ? authPayload.accessToken
        : authPayload && typeof authPayload.token === 'string'
          ? authPayload.token
          : null;
    const accessToken =
      authHeader || readBearerToken(handshakeToken ?? undefined) || cookies.pms_access_token || null;
    const refreshToken = cookies.refreshToken || null;
    const { user } = await resolveSessionUser({
      accessToken,
      refreshToken,
    });

    (socket as TSocketWithUser).data.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch {
    next(new Error('Socket authentication failed'));
  }
}
