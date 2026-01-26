// src/lib/openrouter.ts
// OpenRouter API client for Gemini 2.0 Flash integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Using TNG DeepSeek R1T2 Chimera - free, fast model optimized for dialogue and function calling
const GEMINI_MODEL = 'google/gemma-3-27b-it:free';

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
    max_tokens: 150, // Aggressively reduced to save cost and force conciseness
    // Stop sequences - prevent model from roleplaying future turns or hallucinating results
    stop: ['[Turn', 'User:', 'Aria:', 'FUNCTION_CALL:', '<start_of_turn>', '\nUser:', '\nAria:'],
  };

  try {
    console.log('[Aria Debug] Sending request to OpenRouter...');
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

    console.log('[Aria Debug] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Aria Debug] API Error:', errorData);
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data: OpenRouterResponse = await response.json();
    console.log('[Aria Debug] Full API response:', JSON.stringify(data, null, 2));

    if (!data.choices || data.choices.length === 0) {
      console.error('[Aria Debug] No choices in response');
      throw new Error('No response from Gemini');
    }

    const assistantMessage = data.choices[0].message.content;
    console.log('[Aria Debug] Raw assistant message:', assistantMessage);

    // Strip <think>...</think> reasoning tags
    let cleanedMessage = assistantMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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

        // Manually extract the first valid JSON object to handle multiple calls or noise
        for (let i = 0; i < potentialJson.length; i++) {
          const char = potentialJson[i];
          if (char === '{') {
            braceCount++;
            foundStart = true;
          } else if (char === '}') {
            braceCount--;
          }

          if (foundStart) {
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }

        if (endIndex !== -1) {
          jsonString = potentialJson.substring(0, endIndex);
        } else {
          // Fallback: try to parse the whole trailing string or up to the next newline
          jsonString = potentialJson;
        }

        console.log('[Aria Debug] Parsed JSON string:', jsonString);
        const functionCall = JSON.parse(jsonString);

        console.log('Successfully parsed function call:', functionCall);

        return {
          message: textResponse || 'Processing...',
          rawContent: cleanedMessage, // Keep cleaned message for history (think tags removed, FUNCTION_CALL preserved)
          functionCall: {
            name: functionCall.name,
            arguments: functionCall.arguments || {},
          },
        };
      } catch (parseError) {
        console.error('Failed to parse function call:', parseError);
        return {
          message: textResponse || 'I encountered an issue processing that request.',
          rawContent: cleanedMessage, // Keep cleaned message for history
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
          message: textResponse || 'Processing...',
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
  } catch (error) {
    console.error('[Aria Debug] Error calling OpenRouter:', error);
    throw error;
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
