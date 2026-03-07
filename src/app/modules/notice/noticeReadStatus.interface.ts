import type { Types } from 'mongoose';

export type TNoticeReadStatus = {
  notice: Types.ObjectId;
  userId: string;
  readAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
};
