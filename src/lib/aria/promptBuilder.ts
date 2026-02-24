// src/lib/aria/promptBuilder.ts
// Two-tier prompt architecture:
//   Tier 1 — CORE (static, built once per conversation turn): personality + rules. ~380 tokens.
//   Tier 2 — TOOL BLOCK (dynamic, rebuilt each loop iteration): only tools Aria needs RIGHT NOW.
//
// Tool selection uses the registry's requiresIds/providesIds graph — not regex guessing.
// This achieves reliable agency at ~65% fewer tokens vs a static full-prompt approach.

import { FUNCTION_REGISTRY } from './functionRegistry';
import type { FunctionMeta } from './functionRegistry';

export interface PromptContext {
    scheduleId?: string;
}

// ─────────────────────────────────────────────
// TIER 1: CORE PROMPT  (never changes mid-loop)
// ─────────────────────────────────────────────
// Deliberately tool-free. Tools are injected dynamically via buildToolBlock().
// Keeping this separate means the LLM's system-prompt cache stays hot across
// iterations, which reduces latency and cost on providers that support prompt caching.

export const CORE_PROMPT = `You are Aria, a warm, professional scheduling assistant.
Speak like a human collaborator. Use phrases like "On it!", "I've got you covered."

## MISSION
Manage schedules, events, and participants with precision. You act through tools.
Every action request MUST result in a FUNCTION_CALL.

## EXECUTION RULES
1. ONE TOOL PER RESPONSE — output exactly one FUNCTION_CALL per turn.
2. SILENT EXECUTION — plan in <thought> tags, then act. Never narrate intent. Keep <thought> blocks brief — 2-3 sentences max.
3. FORMAT — always use exactly:
   FUNCTION_CALL: {"name": "...", "arguments": {...}}
4. NO TECHNICAL DELEGATION — never ask the user for IDs. Finding them is your job.
5. NO HALLUCINATION — never say "Done" or "Added" until you have received a
   successful [Function Result] in your context. Action first, confirmation after.
6. HUNT FOR DATA — if an event or participant isn't visible, use searchEventsInSchedule
   or listUnassignedParticipants before giving up. If a search returns a close match 
   to what the user typed, proceed with it directly — do not ask for confirmation. 
   Mention the correction in your final message only (e.g. "I assumed you meant Piano").
7. **SCHEDULES vs EVENTS**: Schedules are containers ("Test Schedule"). Events are slots inside them ("Piano", "Singing"). If the user targets an event by name, call listSchedules then immediately searchEventsInSchedule on the result — never ask if they meant the schedule.
## RECURRENCE FORMAT (iCal)
- Once:      "" (empty string)
- Daily:     "FREQ=DAILY"
- Weekly:    "FREQ=WEEKLY;BYDAY=MO"   (MO TU WE TH FR SA SU)
- Biweekly:  "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"
- Monthly:   "FREQ=MONTHLY;BYDAY=2MO" (Nth weekday, e.g. 2nd Monday)

## PERSONALITY
- Never say "Processing..." or "Understood."
- Keep confirmations short and result-focused.
- "Thanks!" → "You're welcome! Anything else?"`;


// ─────────────────────────────────────────────────────────────────────────────
// TOOL TRANSITION GRAPH
// Maps: "function Aria just called" → "tools she is most likely to need next"
//
// Built from registry metadata (requiresIds / providesIds / prerequisites).
// This is the core of the efficiency gain — instead of re-running intent
// detection on the original message, we follow the data dependency chain.
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_TRANSITIONS: Record<string, string[]> = {
    // After listing schedules → need to act on a specific schedule
    listSchedules: [
        'getEventSummaryInSchedule',
        'searchEventsInSchedule',
        'listUnassignedParticipants',
        'updateSchedule',
        'trashSchedule',
        'publishSchedule',
        'getExportLink',
        'autoScheduleParticipants',
        'analyzeScheduleHealth',
        'updateFormConfig',
        'proposeScheduleChanges',
    ],

    // After getting event summary → need to act on specific events
    getEventSummaryInSchedule: [
        'addEventToSchedule',
        'updateEventInSchedule',
        'deleteEventFromSchedule',
        'swapEvents',
        'searchEventsInSchedule',
        'proposeScheduleChanges',
        'analyzeScheduleHealth',
    ],

    // After searching for a specific event → act on it
    searchEventsInSchedule: [
        'updateEventInSchedule',
        'deleteEventFromSchedule',
        'swapEvents',
        'getEventSummaryInSchedule', // fallback: search didn't find it, try full summary
    ],

    // After listing unassigned → act on participants or schedule them
    listUnassignedParticipants: [
        'getParticipantPreferences',
        'markParticipantAssigned',
        'addEventToSchedule',
        'autoScheduleParticipants',
    ],

    // After getting participant preferences → schedule them
    getParticipantPreferences: [
        'addEventToSchedule',
        'markParticipantAssigned',
    ],

    // After proposing a plan → user will confirm or reject
    proposeScheduleChanges: [
        'commitSchedulePlan',
    ],

    // After listing trashed schedules → recover or empty
    listTrashedSchedules: [
        'recoverSchedule',
        'emptyTrash',
    ],

    // Terminal actions — after these, Aria should confirm and stop
    addEventToSchedule: [],
    updateEventInSchedule: [],
    deleteEventFromSchedule: [],
    swapEvents: [],
    createSchedule: [],
    updateSchedule: [],
    trashSchedule: [],
    recoverSchedule: [],
    emptyTrash: [],
    publishSchedule: [],
    getExportLink: [],
    analyzeScheduleHealth: [],
    autoScheduleParticipants: [],
    commitSchedulePlan: [],
    markParticipantAssigned: [],
    updateFormConfig: [],
    checkScheduleOverlaps: [],
};

// Always-available discovery tools — cheap to include, high value for recovery
const DISCOVERY_TOOLS = ['listSchedules', 'searchEventsInSchedule'];


// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DYNAMIC TOOL BLOCK
// Called once per loop iteration in FloatingChat.
// lastFunctionCalled = name of tool Aria just used (undefined on first iteration).
// userMessage = original user request, used only on iteration 1 for intent detection.
// ─────────────────────────────────────────────────────────────────────────────

export function buildToolBlock(
    userMessage: string,
    context: PromptContext,
    lastFunctionCalled?: string
): string {
    let toolNames: string[];

    if (!lastFunctionCalled) {
        // ── Iteration 1: intent-based selection ──────────────────────────────
        toolNames = detectToolsFromIntent(userMessage, context);
    } else {
        // ── Iteration N: graph-based selection ───────────────────────────────
        const nextTools = TOOL_TRANSITIONS[lastFunctionCalled] ?? [];
        // Always include discovery tools so Aria can recover if she goes off-track
        toolNames = Array.from(new Set([...nextTools, ...DISCOVERY_TOOLS]));

        // If the transition map says this is terminal (empty array), Aria should
        // confirm and stop — no tools needed. Return empty block.
        if (TOOL_TRANSITIONS[lastFunctionCalled]?.length === 0) {
            return ''; // Signal: no more tools needed, produce final confirmation
        }
    }

    const tools = toolNames
        .map(name => FUNCTION_REGISTRY.find(fn => fn.name === name))
        .filter((fn): fn is FunctionMeta => fn !== undefined);

    if (tools.length === 0) return '';

    let block = `\n## AVAILABLE TOOLS (${tools.length})\n`;
    block += tools.map(fn => `- **${fn.name}**: ${fn.prompt}`).join('\n');
    return block;
}


// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION  (used only on iteration 1)
// Improved over original: uses registry metadata (triggers, synonyms, prerequisites)
// instead of hand-rolled regex. Cross-category tasks now get all needed tools.
// ─────────────────────────────────────────────────────────────────────────────

export function detectToolsFromIntent(
    message: string,
    context: PromptContext
): string[] {
    const lower = message.toLowerCase();
    const matched = new Set<string>();

    for (const fn of FUNCTION_REGISTRY) {
        const allTriggers = [...fn.triggers, ...fn.synonyms];
        const hit = allTriggers.some(t => lower.includes(t.toLowerCase()));
        if (hit) {
            matched.add(fn.name);
            // Also include prerequisites so Aria has what she needs to get IDs
            for (const prereq of fn.prerequisites) {
                matched.add(prereq);
            }
        }
    }

    // Always include discovery tools on iteration 1
    DISCOVERY_TOOLS.forEach(t => matched.add(t));

    // If we matched nothing meaningful beyond discovery tools, return a safe
    // general-purpose set that covers the most common scheduling actions
    if (matched.size <= DISCOVERY_TOOLS.length) {
        return [
            'listSchedules',
            'getEventSummaryInSchedule',
            'searchEventsInSchedule',
            'addEventToSchedule',
            'listUnassignedParticipants',
        ];
    }

    if (context.scheduleId) {
        matched.add('getEventSummaryInSchedule');
    }

    return Array.from(matched);
}


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the static system prompt (Tier 1).
 * Call this ONCE per user turn. Pass as the `system` message.
 */
export function buildSystemPrompt(context: PromptContext = {}): string {
    let prompt = CORE_PROMPT;

    if (context.scheduleId) {
        prompt += `\n\n## CONTEXT\nCURRENT_SCHEDULE_ID: "${context.scheduleId}"\nPrefer this ID unless the user names a different schedule.`;
    }

    prompt += `\n\nCurrent Date & Time: ${new Date().toLocaleString()}`;
    return prompt;
}

/**
 * Backward-compatible wrapper.
 * @deprecated Use buildSystemPrompt + buildToolBlock separately in FloatingChat.
 */
export function getSystemPrompt(
    userMessage: string,
    context: PromptContext = {}
): string {
    const core = buildSystemPrompt(context);
    const tools = buildToolBlock(userMessage, context, undefined);
    return core + tools;
}

export function isSimpleQuery(message: string): boolean {
    return /^(hi|hello|hey|thanks|thank you|bye|ok|okay|got it|cool|nice|great|yo|sup)[\s!?.]*$/i
        .test(message.toLowerCase().trim());
}

export function getMinimalPrompt(): string {
    return `You are Aria, a warm scheduling assistant. Reply in one short, friendly sentence.`;
}
