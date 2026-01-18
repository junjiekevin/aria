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
    const functionCallMatch = assistantMessage.match(/FUNCTION_CALL:\s*(\{[\s\S]*?\})\s*$/);
    
    if (functionCallMatch) {
      try {
        // Clean up the JSON string - remove any extra whitespace/newlines
        const jsonString = functionCallMatch[1].trim();
        console.log('Attempting to parse:', jsonString); // Debug
        
        const functionCall = JSON.parse(jsonString);
        
        // Extract the text response (everything before FUNCTION_CALL)
        const textResponse = assistantMessage.split('FUNCTION_CALL:')[0].trim();
        
        console.log('Successfully parsed function call:', functionCall); // Debug
        
        return {
          message: textResponse || 'Executing action...',
          functionCall: {
            name: functionCall.name,
            arguments: functionCall.arguments || {},
          },
        };
      } catch (parseError) {
        console.error('Failed to parse function call:', parseError);
        console.error('Raw match:', functionCallMatch[1]); // Debug
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

## CRITICAL: Function Calling Format

When the user asks you to perform an action (create, list, update, delete schedules), you MUST respond in this EXACT format:

1. First, write a brief friendly message
2. Then on a NEW LINE write exactly: FUNCTION_CALL:
3. Then on the SAME LINE write valid JSON

Example 1 (creating a schedule):
I'll create that schedule for you!
FUNCTION_CALL: {"name": "createSchedule", "arguments": {"label": "Fall 2026 Piano Lessons", "start_date": "2026-09-01", "end_date": "2026-12-15"}}

Example 2 (listing schedules):
Let me check your schedules.
FUNCTION_CALL: {"name": "listSchedules", "arguments": {}}

Example 3 (deleting):
I'll delete that for you.
FUNCTION_CALL: {"name": "deleteSchedule", "arguments": {"schedule_id": "abc123"}}

## Available Functions:
- createSchedule: {"label": "string", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}
- listSchedules: {}
- updateSchedule: {"schedule_id": "string", "label": "string"} (label optional)
- activateSchedule: {"schedule_id": "string"}
- archiveSchedule: {"schedule_id": "string"}
- deleteSchedule: {"schedule_id": "string"}

## Important Rules:
- ALWAYS use YYYY-MM-DD format for dates (e.g., "2026-03-01" not "March 1, 2026")
- When creating schedules, extract the dates from natural language (e.g., "March 1" becomes "2026-03-01")
- When user asks to delete/update a schedule, call listSchedules FIRST to see available schedules and their IDs
- After seeing the list, ask the user to confirm which specific schedule they want to delete/update
- When deleting, ALWAYS use the schedule_id from the list, not the label
- For "delete all", you need to call deleteSchedule multiple times with different IDs (one per schedule)
- Be conversational and friendly, but ALWAYS include FUNCTION_CALL when actions are needed

Remember: You're helping busy teachers save time. Keep responses concise but helpful.`;
