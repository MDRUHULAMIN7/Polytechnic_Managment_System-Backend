import express from 'express';
import validateRequest from '../../middleware/validateRequest.js';
import { ChatbotControllers } from './chatbot.controller.js';
import { ChatbotValidation } from './chatbot.validation.js';

const router = express.Router();

router.post(
  '/ask',
  validateRequest(ChatbotValidation.askQuestionValidationSchema),
  ChatbotControllers.askQuestion,
);

export const ChatbotRoutes = router;
