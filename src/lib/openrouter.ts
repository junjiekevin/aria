// src/lib/openrouter.ts
// OpenRouter API client for Gemini 2.0 Flash integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODEL = 'google/gemini-2.0-flash-exp:free';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  functionCall?: FunctionCall;
}

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Send a chat message to Gemini 2.0 Flash via OpenRouter
 */
export async function sendChatMessage(
  messages: Message[],
  systemPrompt?: string
): Promise<ChatResponse> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  // Build messages array with optional system prompt
  const openRouterMessages: OpenRouterMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const requestBody: OpenRouterRequest = {
    model: GEMINI_MODEL,
    messages: openRouterMessages,
    temperature: 0.7,
    max_tokens: 1000,
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Aria - Scheduling Assistant',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data: OpenRouterResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Gemini');
    }

    const assistantMessage = data.choices[0].message.content;

    return {
      message: assistantMessage,
    };
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    throw error;
  }
}

/**
 * System prompt for Aria scheduling assistant
 */
export const ARIA_SYSTEM_PROMPT = `You are Aria, an intelligent scheduling assistant designed to help teachers manage their recurring weekly schedules.

Your role:
- Help teachers create and manage weekly lesson schedules
- Assist with student placement based on their time preferences
- Handle schedule modifications, swaps, and adjustments
- Provide friendly, conversational, and professional responses
- Guide users through the scheduling process naturally

Key behaviors:
- Be warm, helpful, and encouraging
- Ask clarifying questions when needed
- Confirm actions before making changes
- Provide clear feedback about what you've done
- Alert users to conflicts or issues proactively
- Use natural language, avoid technical jargon

Current capabilities:
- View existing schedules
- Help plan new schedules
- Discuss student preferences
- Suggest optimal time slots
- Explain scheduling decisions

Remember: You're helping busy teachers save time and reduce scheduling stress. Keep responses concise but helpful.`;
