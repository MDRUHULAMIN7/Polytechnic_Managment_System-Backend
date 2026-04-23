import mongoose, { Schema } from 'mongoose';
import type { TPeriodConfig, TPeriodConfigItem } from './periodConfig.interface.js';

const periodConfigItemSchema = new Schema<TPeriodConfigItem>(
  {
    periodNo: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  },
);

const periodConfigSchema = new Schema<TPeriodConfig>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    periods: {
      type: [periodConfigItemSchema],
      required: true,
      validate: {
        validator: (value: TPeriodConfigItem[]) => Array.isArray(value) && value.length > 0,
        message: 'At least one period is required.',
      },
    },
    createdBy: {
      type: String,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

periodConfigSchema.index({ isActive: 1, effectiveFrom: -1 });

export const PeriodConfig = mongoose.model<TPeriodConfig>(
  'PeriodConfig',
  periodConfigSchema,
);
