import config from '../config/index.js';
import { logger } from '../utils/logger.js';

export type TOpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type TOpenRouterRequestOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type TOpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
  model?: string;
};

type TOpenRouterMessageContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>
  | undefined;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const resolveMessageContent = (content: TOpenRouterMessageContent) => {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
};

export const createOpenRouterChatCompletion = async (
  messages: TOpenRouterMessage[],
  options?: TOpenRouterRequestOptions,
) => {
  if (!config.openrouter_api_key) {
    throw new Error('OPENROUTER_API_KEY is missing.');
  }

  const requestBody = JSON.stringify({
    model: options?.model ?? config.openrouter_model ?? 'openai/gpt-5.2',
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 700,
    messages,
  });

  let response: Response | null = null;
  let text = '';

  for (let attempt = 0; attempt <= config.openrouter_max_retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.openrouter_timeout_ms);

    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openrouter_api_key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            config.openrouter_site_url ?? 'https://polytechnic-management.local',
          'X-OpenRouter-Title': 'Polytechnic Management System',
        },
        body: requestBody,
        signal: controller.signal,
      });

      text = await response.text();

      if (response.ok || attempt === config.openrouter_max_retries) {
        break;
      }

      if (response.status !== 429 && response.status < 500) {
        break;
      }
    } catch (error) {
      if (attempt === config.openrouter_max_retries) {
        throw error;
      }

      logger.warn('Retrying OpenRouter request after transient failure.', {
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    throw new Error('OpenRouter request could not be completed.');
  }

  let payload: TOpenRouterResponse | null = null;

  try {
    payload = JSON.parse(text) as TOpenRouterResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload ? JSON.stringify(payload) : text.slice(0, 300).trim();
    throw new Error(
      detail
        ? `OpenRouter request failed: ${detail}`
        : 'OpenRouter request failed.',
    );
  }

  const content = resolveMessageContent(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenRouter returned an empty completion.');
  }

  return {
    content,
    model: payload?.model ?? options?.model ?? config.openrouter_model ?? null,
  };
};
