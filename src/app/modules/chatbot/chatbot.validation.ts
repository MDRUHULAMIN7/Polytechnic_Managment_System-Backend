import { z } from 'zod';

const askQuestionValidationSchema = z.object({
  body: z.object({
    question: z
      .string()
      .trim()
      .min(2, 'Question must be at least 2 characters')
      .max(500, 'Question must be less than 500 characters'),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z
            .string()
            .trim()
            .min(1, 'Message content is required')
            .max(2000, 'Message content is too long'),
        }),
      )
      .max(8, 'Too many chat history messages')
      .optional(),
  }),
});

export const ChatbotValidation = {
  askQuestionValidationSchema,
};
