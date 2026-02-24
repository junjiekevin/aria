// src/lib/openrouter.ts
// OpenRouter API client for ARIA AI integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = [
  'google/gemini-2.5-flash-lite',
  'z-ai/glm-4.7-flash',
  'google/gemma-3-27b-it',
];

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
  rawContent?: string; // Original unstripped message for history
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
  stop?: string[];
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
 * Send a chat message to the configured AI model via OpenRouter
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

  let lastError: any = null;

  for (const model of MODELS) {
    const requestBody: OpenRouterRequest = {
      model: model,
      messages: openRouterMessages,
      temperature: 0.7,
      max_tokens: 4000, // Significantly increased to handle verbose thought blocks without truncation
      // Stop sequences - prevent model from roleplaying future turns or hallucinating results
      stop: ['[Turn', 'User:', '<start_of_turn>', '\nUser:', '\nAria:'],
    };

    try {
      console.log(`[Aria Debug] Attempting request using model: ${model}`);
      console.log('[Aria Debug] Messages:', JSON.stringify(openRouterMessages.slice(-3), null, 2));

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

      console.log(`[Aria Debug] ${model} Response status:`, response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[Aria Debug] ${model} Failed:`, errorData);

        // If it's a rate limit (429) or server error (500+), try the next model
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Model ${model} failed (${response.status}). Trying fallback...`);
          continue;
        }

        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data: OpenRouterResponse = await response.json();
      console.log('[Aria Debug] Full API response:', JSON.stringify(data, null, 2));

      if (!data.choices || data.choices.length === 0) {
        console.error('[Aria Debug] No choices in response');
        throw new Error('No response from AI');
      }

      const assistantMessage = data.choices[0].message.content;
      console.log('[Aria Debug] Raw assistant message:', assistantMessage);

      // Strip <think>...</think> and <thought>...</thought> reasoning tags
      let cleanedMessage = assistantMessage.replace(/<(thought|think)>[\s\S]*?<\/(thought|think)>/gi, '').trim();

      // 1. Force-remove "Aria:" prefix if the model stubbornly ignores the prompt
      if (cleanedMessage.startsWith('Aria:')) {
        cleanedMessage = cleanedMessage.substring(5).trim();
      } else if (cleanedMessage.startsWith('"') && cleanedMessage.includes('Aria: "')) {
        // Catch scenarios like: "Aria: "Message""
        cleanedMessage = cleanedMessage.replace(/^"?Aria:\s*"/, '').replace(/"$/, '');
      }

      // 2. Client-Side Stop Sequence Enforcement (Hallucination Slayer)
      // If the model generates a script (User: ... Aria: ...), we cut it off at the first sign of a new turn.
      const stopTriggers = ['\nUser:', '\nAria:', '[Turn', '<start_of_turn>'];
      for (const trigger of stopTriggers) {
        const index = cleanedMessage.indexOf(trigger);
        if (index !== -1) {
          console.log(`[Aria Debug] Detected stop trigger "${trigger}" at index ${index}. Truncating.`);
          cleanedMessage = cleanedMessage.substring(0, index).trim();
        }
      }

      console.log('[Aria Debug] Final sanitized message:', cleanedMessage);

      // Helper: Strip ALL function call syntax from message for display
      const stripFunctionCalls = (msg: string): string => {
        // Robustly truncate at the first sign of a function call to ensure clean UI
        const functionCallIndex = msg.indexOf('FUNCTION_CALL:');
        if (functionCallIndex !== -1) {
          return msg.substring(0, functionCallIndex).trim();
        }

        const toolCallIndex = msg.indexOf('<tool_call>');
        if (toolCallIndex !== -1) {
          return msg.substring(0, toolCallIndex).trim();
        }

        return msg.trim();
      };

      const textResponse = stripFunctionCalls(cleanedMessage);

      // 1. Look for FUNCTION_CALL: pattern (in cleaned message, not raw)
      const functionCallMarker = 'FUNCTION_CALL:';
      const firstCallIndex = cleanedMessage.indexOf(functionCallMarker);

      // 2. Look for <tool_call> pattern (in cleaned message)
      const toolCallMatch = cleanedMessage.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);

      if (firstCallIndex !== -1) {
        try {
          const start = firstCallIndex + functionCallMarker.length;
          const potentialJson = cleanedMessage.substring(start).trim();

          let jsonString = '';
          let braceCount = 0;
          let foundStart = false;
          let endIndex = -1;

          for (let i = 0; i < potentialJson.length; i++) {
            const char = potentialJson[i];
            if (char === '{') {
              braceCount++;
              foundStart = true;
            } else if (char === '}') {
              braceCount--;
            }
            if (foundStart && braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }

          jsonString = endIndex !== -1 ? potentialJson.substring(0, endIndex) : potentialJson;

          let functionCall: any;

          // --- 3-TIER JSON RECOVERY ---
          try {
            // Tier 1: Standard Parse
            functionCall = JSON.parse(jsonString);
          } catch (e) {
            console.warn('[Aria Debug] Stage 1 JSON Parse failed. Trying Stage 2 (Heuristics)...');
            const repaired = repairJsonHeuristics(jsonString);
            try {
              // Tier 2: Heuristic Repair
              functionCall = JSON.parse(repaired);
              console.log('[Aria Debug] Stage 2 Recovery Successful');
            } catch (e2) {
              console.warn('[Aria Debug] Stage 2 Heuristics failed. Trying Stage 3 (AI Repair)...');
              // Tier 3: AI-Powered Recovery
              functionCall = await fixJsonWithAI(jsonString);
              if (!functionCall) throw new Error('AI Repair returned null');
              console.log('[Aria Debug] Stage 3 Recovery Successful');
            }
          }

          return {
            message: textResponse || 'On it! One moment, please',
            rawContent: cleanedMessage,
            functionCall: {
              name: functionCall.name,
              arguments: functionCall.arguments || {},
            },
          };
        } catch (recoveryError) {
          console.error('[Aria Debug] All JSON recovery stages failed:', recoveryError);
          return {
            message: textResponse || 'I encountered an issue processing that request.',
            rawContent: cleanedMessage,
            functionCall: undefined,
          };
        }
      } else if (toolCallMatch) {
        // ... existing tool_call logic if needed, or unify it. 
        // For now, let's just handle it similarly or return the existing match logic 
        // but since we want to be robust, let's trust the FUNCTION_CALL logic primarily 
        // as that's what the prompt uses. 

        try {
          const functionCall = JSON.parse(toolCallMatch[1]);
          return {
            message: textResponse || 'On it! One moment, please',
            rawContent: cleanedMessage, // Keep cleaned message for history
            functionCall: {
              name: functionCall.name,
              arguments: functionCall.arguments || {},
            }
          }
        } catch (e) {
          // ignore
        }
      }

      console.log('[Aria Debug] No function call detected, returning plain message');
      return {
        message: textResponse,
        rawContent: cleanedMessage, // Keep cleaned message for history
        functionCall: undefined,
      };
    } catch (error: any) {
      console.error(`[Aria Debug] Error with ${model}:`, error);
      lastError = error;
      // Continue to next model if it's a transient or fallback-eligible error
      if (error.message?.includes('429') || error.message?.includes('500') || error.message?.includes('fetch')) {
        continue;
      }
      // Otherwise re-throw
      throw error;
    }
  }

  throw lastError || new Error('All AI models failed to respond.');
}

/**
 * Stage 2: Heuristic JSON Repair
 * Fixes common minor syntax errors like smart quotes, unquoted keys, or trailing commas.
 */
export function repairJsonHeuristics(input: string): string {
  let json = input.trim();

  // 1. Replace smart quotes/apostrophes
  json = json.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 2. Remove trailing commas in objects and arrays
  json = json.replace(/,\s*([\]}])/g, '$1');

  // 3. Ensure keys are double-quoted if they aren't
  // This is a simple regex for word-like keys without quotes
  json = json.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

  return json;
}

/**
 * Stage 3: AI-Powered JSON Recovery
 * Uses an ultra-cheap model to fix complex syntax errors.
 */
async function fixJsonWithAI(malformedJson: string): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const repairPrompt = `You are a specialized JSON repair utility. 
The following snippet is a malformed JSON object representing a function call.
Fix the syntax errors (missing braces, quotes, commas, etc.) and return ONLY the valid JSON object.
Do not explain anything. Do not include markdown code blocks.

MALFORMED JSON:
${malformedJson}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-4b:free',
        messages: [{ role: 'user', content: repairPrompt }],
        temperature: 0,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    if (!content) return null;

    // Strip backticks if the model ignores the "no markdown" rule
    const jsonOnly = content.replace(/```json\s*|```/g, '').trim();
    return JSON.parse(jsonOnly);
  } catch (e) {
    console.error('[Aria Debug] AI JSON Repair failed:', e);
    return null;
  }
}

/**
 * @deprecated Use getSystemPrompt from './aria' instead
 * This monolithic prompt has been replaced by the Function Registry system
 * for better context management and scalability.
 *
 * The new system dynamically builds prompts based on detected user intent,
 * injecting only relevant function context to prevent context rot.
 *
 * See: src/lib/aria/functionRegistry.ts - Function definitions
 * See: src/lib/aria/promptBuilder.ts - Dynamic prompt builder
 */
export { getSystemPrompt as ARIA_SYSTEM_PROMPT } from './aria';
