import mongoose, { Schema } from 'mongoose';
import type { TRoom } from './room.interface.js';

const roomSchema = new Schema<TRoom>(
  {
    roomName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    roomNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    buildingNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    floor: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

roomSchema.index(
  { buildingNumber: 1, roomNumber: 1 },
  { unique: true, name: 'building_room_unique' },
);

export const Room = mongoose.model<TRoom>('Room', roomSchema);
