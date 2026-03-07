import { z } from 'zod';
import {
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_STATUSES,
  NOTICE_TARGET_AUDIENCES,
} from './notice.constant.js';

const attachmentValidationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url(),
  fileType: z.string().trim().max(40).optional(),
  size: z.number().min(0).max(10 * 1024 * 1024).optional(),
});

const createNoticeValidationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(200),
    content: z.string().trim().min(10).max(10000),
    attachments: z.array(attachmentValidationSchema).max(5).optional(),
    targetAudience: z.enum(NOTICE_TARGET_AUDIENCES),
    targetDepartments: z.array(z.string().trim().min(1)).optional(),
    category: z.enum(NOTICE_CATEGORIES),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    priority: z.enum(NOTICE_PRIORITIES).optional(),
    isPinned: z.boolean().optional(),
    publishedAt: z.string().trim().datetime().optional(),
    expiresAt: z.string().trim().datetime().optional(),
    requiresAcknowledgment: z.boolean().optional(),
    status: z.enum(NOTICE_STATUSES).optional(),
  }),
});

const updateNoticeValidationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(200).optional(),
    content: z.string().trim().min(10).max(10000).optional(),
    attachments: z.array(attachmentValidationSchema).max(5).optional(),
    targetAudience: z.enum(NOTICE_TARGET_AUDIENCES).optional(),
    targetDepartments: z.array(z.string().trim().min(1)).optional(),
    category: z.enum(NOTICE_CATEGORIES).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    priority: z.enum(NOTICE_PRIORITIES).optional(),
    isPinned: z.boolean().optional(),
    publishedAt: z.string().trim().datetime().optional(),
    expiresAt: z.string().trim().datetime().optional(),
    requiresAcknowledgment: z.boolean().optional(),
    status: z.enum(NOTICE_STATUSES).optional(),
  }),
});

export const NoticeValidation = {
  createNoticeValidationSchema,
  updateNoticeValidationSchema,
};
