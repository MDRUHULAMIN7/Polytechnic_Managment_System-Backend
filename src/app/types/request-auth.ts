import type { JwtPayload } from 'jsonwebtoken';
import type { TUserRole } from '../modules/user/user.interface.js';

export type TAuthenticatedRequestUser = JwtPayload & {
  userId: string;
  id: string;
  role: TUserRole;
  email: string;
  permissions?: string[];
};
