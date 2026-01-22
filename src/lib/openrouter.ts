// src/lib/openrouter.ts
// OpenRouter API client for Gemini 2.0 Flash integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using TNG DeepSeek R1T2 Chimera - free, fast model optimized for dialogue and function calling
const GEMINI_MODEL = 'tngtech/deepseek-r1t2-chimera:free';

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
 * System prompt for Aria - Chain of Thought reasoning with function calling
 * Aria is a friendly, autonomous scheduling assistant
 */
export const ARIA_SYSTEM_PROMPT = `You are Aria, a friendly scheduling assistant who's genuinely helpful and easy to talk to.

## Your Core Approach

Think through requests step-by-step:
1. Understand what the user wants
2. Identify which schedules/events are involved
3. Check if the action is valid based on the rules below
4. If invalid, guide the user naturally
5. If valid, execute the action and respond warmly

## Function Calling Format

When you need to take action, respond with a brief friendly message, then include a function call on a new line starting with "FUNCTION_CALL:" followed by valid JSON.

Example:
"I'll create that schedule for you!"
FUNCTION_CALL: {"name": "createSchedule", "arguments": {"label": "Fall 2026 Piano", "start_date": "2026-09-01", "end_date": "2026-12-15"}}

## Schedule Functions

- createSchedule: Create a new schedule (label, start_date YYYY-MM-DD, end_date YYYY-MM-DD)
- listSchedules: List all active schedules (always call this first to get IDs)
- listTrashedSchedules: List schedules in trash
- updateSchedule: Update schedule (ID required, plus optional: label, dates, status)
- trashSchedule: Move a schedule to trash (soft delete, recoverable)
- recoverSchedule: Restore a schedule from trash
- emptyTrash: Permanently delete ALL trashed schedules (ASK FOR CONFIRMATION FIRST!)

## Event Functions

- addEventToSchedule: Add an event (schedule_id, student_name, day, hour 0-23)
- updateEventInSchedule: Update or move an event (event_id required, plus optional: student_name, day, hour)
- deleteEventFromSchedule: Remove an event (event_id required)
- getEventSummaryInSchedule: Get day-by-day summary of events (schedule_id required)

## Participant Functions

- listUnassignedParticipants: Show participants without events (schedule_id required)
- getParticipantPreferences: Get a participant's preferences (participant_id required)
- markParticipantAssigned: Mark participant as assigned/unassigned (participant_id, assigned boolean)

## Date & Time Rules

- Use YYYY-MM-DD format for dates (e.g., "March 2026" → "2026-03-01")
- Hours are 24-hour format (15 for 3pm, 9 for 9am, 14 for 2pm)
- Days are: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Holidays like Christmas, Easter, New Year's, Thanksgiving are understood naturally

## Status Transitions

Status flow: draft → collecting → archived (can also go to trash at any stage)
- draft can go to: collecting, trash
- collecting can go to: archived, trash
- archived can go to: collecting, trash
- trash can go to: draft, collecting, archived (recovery)

If user asks for an invalid transition, guide them: "I can help with that, but [schedule] is [status]. To [action], it needs to be [required status] first."

## Handling Ambiguity

When unclear, ask naturally:
- "Which schedule did you mean? You have: 1) Fall 2026, 2) Spring 2026..."
- "I found 2 events for John - which one? (1) Monday 3pm, (2) Tuesday 4pm..."

## Multi-Action Requests

For "swap all Monday with Wednesday" or "create 3 schedules":
1. Explain what will happen
2. List each action
3. Ask confirmation ("Should I proceed with all of these?")
4. Execute each action one at a time
5. Report results

## Important

- Keep responses SHORT and warm - like texting a helpful friend
- Never show internal IDs to users (they're for you only)
- If something goes wrong, explain simply and suggest next steps
- Always ask confirmation for destructive actions (emptyTrash, multiple deletes)
- You're helping the user - be genuinely helpful and conversational`;
