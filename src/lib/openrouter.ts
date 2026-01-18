// src/lib/openrouter.ts
// OpenRouter API client for Gemini 2.0 Flash integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using Xiaomi Mimo V2 Flash - free model with good availability
const GEMINI_MODEL = 'xiaomi/mimo-v2-flash:free';

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

    // Check if the response contains a function call (JSON format)
    // Pattern: The AI will respond with FUNCTION_CALL: {...json...}
    const functionCallMatch = assistantMessage.match(/FUNCTION_CALL:\s*(\{[\s\S]*?\})/);
    
    if (functionCallMatch) {
      try {
        const functionCall = JSON.parse(functionCallMatch[1]);
        
        // Extract the text response (everything before FUNCTION_CALL)
        const textResponse = assistantMessage.split('FUNCTION_CALL:')[0].trim();
        
        return {
          message: textResponse || 'Executing action...',
          functionCall: {
            name: functionCall.name,
            arguments: functionCall.arguments || {},
          },
        };
      } catch (parseError) {
        console.error('Failed to parse function call:', parseError);
        // If parsing fails, just return the message
        return { message: assistantMessage };
      }
    }

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

## Available Functions

You can perform actions by calling these functions. When you want to call a function, respond with:
1. A brief message explaining what you're doing
2. On a new line, write: FUNCTION_CALL: followed by valid JSON

Example response format:
"I'll create that schedule for you!
FUNCTION_CALL: {"name": "createSchedule", "arguments": {"label": "Fall 2026 Piano Lessons", "start_date": "2026-09-01", "end_date": "2026-12-15"}}"

Available functions:
- createSchedule: Create a new schedule. Args: {label: string, start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD"}
- listSchedules: Get all schedules. Args: {}
- updateSchedule: Update a schedule. Args: {schedule_id: string, label?: string, start_date?: string, end_date?: string}
- activateSchedule: Activate a draft schedule. Args: {schedule_id: string}
- archiveSchedule: Archive a completed schedule. Args: {schedule_id: string}
- deleteSchedule: Move schedule to trash. Args: {schedule_id: string}

Important:
- Always confirm the user's intent before calling functions
- Use YYYY-MM-DD format for dates
- When listing schedules, call listSchedules first to get current data
- Be conversational - don't just call functions, explain what you're doing

Remember: You're helping busy teachers save time and reduce scheduling stress. Keep responses concise but helpful.`;
