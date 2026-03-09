import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/CatchAsync.js';
import sendResponse from '../../utils/sendResponse.js';
import { ChatbotServices } from './chatbot.service.js';

const askQuestion = catchAsync(async (req, res) => {
  const result = await ChatbotServices.generateReply(
    req.body.question,
    req.body.messages ?? [],
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chatbot reply generated successfully',
    data: result,
  });
});

export const ChatbotControllers = {
  askQuestion,
};
