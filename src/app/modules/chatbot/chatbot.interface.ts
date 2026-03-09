export type TChatbotIntent =
  | 'ai'
  | 'department_recommendation'
  | 'department_list'
  | 'semester_current'
  | 'semester_registration'
  | 'semester_list'
  | 'instructor_list'
  | 'fallback';

export type TChatbotMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type TChatbotReply = {
  question: string;
  answer: string;
  matchedIntent: TChatbotIntent;
  suggestions: string[];
  source?: 'ai' | 'fallback';
};
