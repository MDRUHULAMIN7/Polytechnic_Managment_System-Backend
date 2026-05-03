import type { TAuthenticatedRequestUser } from '../app/types/request-auth.js';

declare global {
  namespace Express {
    interface Request {
      user: TAuthenticatedRequestUser;
      requestId?: string;
    }
  }
}

export {};
