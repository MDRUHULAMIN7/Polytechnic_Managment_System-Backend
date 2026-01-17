import { model, Schema } from 'mongoose';
import type { TUser } from './user.interface.js';

const userSchema = new Schema<TUser>(
  {
    id: {
      type: String,
      required: true,
      unique:true
    },
    password: {
      type: String,
      required: true,
    },
    needsPasswordChange: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['student', 'admin', 'instructor'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active','blocked'],
      default:'active'
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const User = model<TUser>('User',userSchema);