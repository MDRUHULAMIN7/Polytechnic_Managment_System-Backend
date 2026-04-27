import mongoose, { Schema } from 'mongoose';
import type { TRoom } from './room.interface.js';

const roomSchema = new Schema<TRoom>(
  {
    roomName: {
      type: String,
      required: true,
      trim: true,
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
    roomType: {
      type: String,
      enum: ['theory', 'practical', 'both'],
      default: 'theory',
      required: true,
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

roomSchema.index({ roomNumber: 1 }, { unique: true, name: 'room_number_unique' });

export const Room = mongoose.model<TRoom>('Room', roomSchema);

let roomIndexesSynced = false;

export const syncRoomIndexes = async () => {
  if (roomIndexesSynced) {
    return;
  }

  await Room.syncIndexes();
  roomIndexesSynced = true;
};
