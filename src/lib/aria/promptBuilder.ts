// src/lib/aria/promptBuilder.ts
// Aria's Employee Handbook - Structured for personality + reliable execution

import { FUNCTION_REGISTRY } from './functionRegistry';
import type { FunctionMeta } from './functionRegistry';

export interface PromptContext {
  scheduleId?: string;
}

/**
 * Aria Employee Handbook
 * Structured as a training manual for consistent, warm, autonomous behavior
 */
const CORE_PROMPT = `You are Aria, a precise but warm scheduling assistant.
Your goal is to manage schedules and events by calling functions.

## RULES
1. **TOOL USE IS MANDATORY**: If a user request requires an action (add, update, delete, list), you MUST use a tool.
2. **NO HALLUCIDATIONS**: Do NOT say you did something unless you have called the tool and received a result.
3. **FORMAT**: To call a tool, you must use EXACTLY this format:
   FUNCTION_CALL: {"name": "function_name", "arguments": { ... }}
4. **SILENCE**: When calling a tool, do NOT write any other text. Just the FUNCTION_CALL.
5. **THOUGHTS**: You can include a short <thought>...</thought> block before the FUNCTION_CALL if needed to plan parameters.

## PERSONAL STYLE (CRITICAL)
- **Be Warm & Friendly**: Avoid robotic "Okay" or "Processing" responses. Use "I'd be happy to...", "On it...", "Let me handle that...".
- **Natural Language**: Speak like a helpful human assistant.
- **Short & Sweet**: Keep confirmation messages concise but polite.

## TOOL DEFINITIONS
`;

export function isSimpleQuery(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return /^(hi|hello|hey|thanks|thank you|bye|ok|okay|got it|cool|nice|great|yo|sup)[\s!?.]*$/.test(lower);
}

export function buildSystemPrompt(
  _message: string,
  context: PromptContext = {}
): string {
  let prompt = CORE_PROMPT;

  // Dynamically build the full toolkit list
  const toolkitList = FUNCTION_REGISTRY.map(fn =>
    `- ${fn.name}: ${fn.prompt}`
  ).join('\n');

  prompt += toolkitList;

  prompt += `\n\n## EXAMPLES
User: "Add Singing on Fridays at 4pm"
Assistant: <thought>User wants a weekly event. I need to use addEventToSchedule.</thought>
FUNCTION_CALL: {"name":"addEventToSchedule","arguments":{"schedule_id":"${context.scheduleId || 'YOUR_SCHEDULE_ID'}","student_name":"Singing","day":"Friday","hour":16,"recurrence_rule":"FREQ=WEEKLY;BYDAY=FR"}}

User: "List my schedules"
Assistant: FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
`;

  if (context.scheduleId) {
    prompt += `\n\n## CONTEXT\nCURRENT_SCHEDULE_ID: "${context.scheduleId}"`;
  }

  return prompt;
}

export function getSystemPrompt(
  userMessage: string,
  context: PromptContext = {}
): string {
  // Always use the detailed prompt for now to ensure tool consistency, 
  // even for simple queries, to avoid mode switching confusion.
  // if (isSimpleQuery(userMessage)) { return MINIMAL_PROMPT; } 
  return buildSystemPrompt(userMessage, context);
}

const MINIMAL_PROMPT = `You are Aria, a warm and friendly scheduling assistant. Keep responses to 1 short sentence. Be casual and helpful. If you need to take action, end with FUNCTION_CALL: {"name":"...","arguments":{...}}`;

export function getMinimalPrompt(): string {
  return MINIMAL_PROMPT;
}

export function detectRelevantFunctions(
  _message: string,
  _context: PromptContext
): FunctionMeta[] {
  return FUNCTION_REGISTRY;
}

export { CORE_PROMPT };
