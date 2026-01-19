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

    // Check if the response contains a function call
    // Supports two formats:
    // 1. FUNCTION_CALL: {...json...} (preferred)
    // 2. <tool_call>{...json...}</tool_call> (alternative)
    const functionCallPatterns = [
      { regex: /FUNCTION_CALL:\s*(\{[\s\S]*?\})\s*$/, key: 'FUNCTION_CALL' },
      { regex: /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/, key: 'tool_call' },
    ];

    let functionCallMatch = null;
    let matchedPattern = null;

    for (const pattern of functionCallPatterns) {
      functionCallMatch = assistantMessage.match(pattern.regex);
      if (functionCallMatch) {
        matchedPattern = pattern.key;
        break;
      }
    }
    
    if (functionCallMatch) {
      try {
        const jsonString = functionCallMatch[1].trim();
        console.log(`Attempting to parse (${matchedPattern}):`, jsonString);
        
        const functionCall = JSON.parse(jsonString);
        
        const textResponse = assistantMessage
          .replace(/FUNCTION_CALL:\s*\{[\s\S]*?\}\s*$/, '')
          .replace(/<tool_call>\s*\{[\s\S]*?\}\s*<\/tool_call>/, '')
          .trim();
        
        console.log('Successfully parsed function call:', functionCall);
        
        return {
          message: textResponse || 'Executing action...',
          functionCall: {
            name: functionCall.name,
            arguments: functionCall.arguments || {},
          },
        };
      } catch (parseError) {
        console.error('Failed to parse function call:', parseError);
        return {
          message: assistantMessage,
          functionCall: undefined,
        };
      }
    }

    return {
      message: assistantMessage,
      functionCall: undefined,
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
- createSchedule: {"label": "string", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"} (for ONE schedule)
- createMultipleSchedules: {"schedules": [{"label": "...", "start_date": "...", "end_date": "..."}]} (for 2+ schedules at once)
- listSchedules: {} (shows only non-trashed schedules)
- listTrashedSchedules: {} (shows ONLY trashed/deleted schedules)
- deleteSchedule: {"schedule_id": "string"} (moves ONE schedule to trash, recoverable within 30 days)
- deleteAllSchedules: {} (moves ALL schedules to trash, recoverable within 30 days)
- recoverSchedule: {"schedule_id": "string"} (restores a trashed schedule to its previous status)
- updateSchedule: {"schedule_id": "string", "label": "string"} (label optional)
- activateSchedule: {"schedule_id": "string"}
- archiveSchedule: {"schedule_id": "string"}

## Trash and Recovery:
- Schedules moved to trash are recoverable within 30 days
- After 30 days, trashed schedules are automatically permanently deleted (handled automatically by system)
- Users can restore trashed schedules to their previous status at any time
- Note: Permanent deletion is ONLY available manually through the UI, AI cannot perform hard deletes

## Important Rules:
- ALWAYS use YYYY-MM-DD format for dates (e.g., "2026-03-01" not "March 1, 2026")
- When creating schedules, extract dates from natural language (e.g., "March 1, 2026" → "2026-03-01")
- When user asks to create MULTIPLE schedules (2 or more), use createMultipleSchedules with all schedules in one call
- When user asks about TRASHED or DELETED schedules, use listTrashedSchedules (NOT listSchedules)
- When user asks to delete, update, or recover a SPECIFIC schedule (by name):
  1. Call listSchedules for active schedules OR listTrashedSchedules for trashed schedules
  2. Find the schedule that MATCHES or PARTIALLY MATCHES the user's request
  3. Extract the EXACT UUID from the brackets in the response (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  4. Call the appropriate function IMMEDIATELY with the exact UUID
  5. If NO schedules match, say "No schedules found matching '[user's request]'. What would you like to do next?"
- CRITICAL: You MUST extract and use the EXACT UUID from the brackets. Examples:
  * Response: '1. "Summer 2026 Voice" (Draft) [bdb3258e-8e85-41a9-bba3-2459a4c9e11d]'
  * Extract: bdb3258e-8e85-41a9-bba3-2459a4c9e11d (36 characters with dashes)
  * Use exactly: {"schedule_id": "bdb3258e-8e85-41a9-bba3-2459a4c9e11d"}
- When user asks to "delete all" schedules, call deleteAllSchedules directly
- NEVER show your reasoning or thinking process to the user
- NEVER show schedule IDs to users
- Keep responses SHORT and conversational

Remember: You're helping busy teachers. Be concise and professional.`;
