import express from 'express';
import validateRequest from '../../middleware/validateRequest.js';
import { ChatbotControllers } from './chatbot.controller.js';
import { ChatbotValidation } from './chatbot.validation.js';
import { createRateLimit } from '../../middleware/rateLimit.js';
import config from '../../config/index.js';

const router = express.Router();
const chatbotRateLimit = createRateLimit({
  name: 'chatbot-public',
  windowMs: config.chatbot_rate_limit_window_ms,
  max: config.chatbot_rate_limit_max,
});

router.post(
  '/ask',
  chatbotRateLimit,
  validateRequest(ChatbotValidation.askQuestionValidationSchema),
  ChatbotControllers.askQuestion,
);

export const ChatbotRoutes = router;
