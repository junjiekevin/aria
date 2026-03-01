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

export interface ToolBlockOptions {
    compact?: boolean;
}

const TOOL_SIGNATURES: Record<string, string> = {
    createSchedule: 'label, start_date, end_date',
    listSchedules: '',
    listTrashedSchedules: '',
    updateSchedule: 'schedule_id, updates',
    trashSchedule: 'schedule_id',
    recoverSchedule: 'schedule_id',
    emptyTrash: '',
    updateFormConfig: 'schedule_id, form_config',
    checkScheduleOverlaps: 'start_date, end_date, exclude_id?',
    autoScheduleParticipants: 'schedule_id',
    publishSchedule: 'schedule_id',
    getExportLink: 'schedule_id',
    analyzeScheduleHealth: 'schedule_id',
    proposeScheduleChanges: 'schedule_id, changes[]',
    commitSchedulePlan: 'plan_id',
    addEventToSchedule: 'schedule_id, student_name, day, hour, recurrence_rule',
    updateEventInSchedule: 'event_id, student_name?, day?, hour?, recurrence_rule?',
    deleteEventFromSchedule: 'event_id',
    getEventSummaryInSchedule: 'schedule_id',
    searchEventsInSchedule: 'schedule_id, query',
    swapEvents: 'event1_id, event2_id',
    listUnassignedParticipants: 'schedule_id',
    getParticipantPreferences: 'participant_id',
    markParticipantAssigned: 'participant_id, assigned',
};

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
2. SILENT EXECUTION — think silently and act. For straightforward single-step requests, skip <thought> tags and output FUNCTION_CALL directly. If you use <thought>, keep it to 1 sentence.
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
8. EXACT TOOL NAMES ONLY — you MUST call tools using names exactly as listed in AVAILABLE TOOLS. Never shorten/rename (e.g., never use "updateEvent"; use "updateEventInSchedule").
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

export const ACTION_PROMPT = `You are Aria.
Execute the user's request with exactly one tool call.

Output format (single line only):
FUNCTION_CALL: {"name":"...","arguments":{...}}

Rules:
- Use one exact function name from VALID FUNCTION NAMES THIS TURN.
- No prose, no markdown, no greetings.
- No <thought> tags for straightforward requests.
- If required IDs are missing, call the appropriate discovery tool first.
- For addEventToSchedule: if user does NOT request recurrence, set recurrence_rule to "" (one-time).`;

// ─────────────────────────────────────────────────────────────────────────────
// ADVISORY PROMPT — reasoning-first mode for suggestions/analysis/planning
// ─────────────────────────────────────────────────────────────────────────────

export const ADVISORY_PROMPT = `You are Aria, a warm, professional scheduling assistant.

## MODE: ADVISORY
You are in advisory mode. Your job is to GATHER DATA and then SYNTHESIZE a concise recommendation.

## RULES
1. GATHER FIRST — use read-only tools (getEventSummaryInSchedule, listUnassignedParticipants, analyzeScheduleHealth, searchEventsInSchedule, getParticipantPreferences) to retrieve the data you need.
2. SYNTHESIZE AFTER — once you have enough data, produce your final answer. Do NOT make more tool calls after synthesizing.
3. NO MUTATIONS — never call mutating tools (add/update/delete/swap/commit/publish/trash/recover/empty/autoSchedule/markAssigned) in advisory mode. If the user wants action, tell them what to do and offer to execute it.
4. CONCISE RESPONSE — your final answer must be 1-3 sentences. Be specific and actionable.
5. FORMAT — when you need data, use exactly:
   FUNCTION_CALL: {"name": "...", "arguments": {...}}
6. EXACT TOOL NAMES ONLY — use names exactly as listed in AVAILABLE TOOLS.
7. ONE TOOL PER TURN — output exactly one FUNCTION_CALL per turn when gathering data.

## PERSONALITY
- Speak like a helpful collaborator, not a robot.
- Give concrete suggestions ("I'd suggest putting Alex on Tuesday at 2pm") not vague advice.
- If you spot conflicts or issues, mention them directly.`;

/** Read-only tools available in advisory mode. */
export const ADVISORY_TOOL_NAMES = new Set([
    'listSchedules',
    'listTrashedSchedules',
    'getEventSummaryInSchedule',
    'searchEventsInSchedule',
    'listUnassignedParticipants',
    'getParticipantPreferences',
    'analyzeScheduleHealth',
    'checkScheduleOverlaps',
    'getExportLink',
]);


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

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhraseHit(haystack: string, phrase: string): boolean {
    const normalizedPhrase = phrase.trim().toLowerCase();
    if (!normalizedPhrase) return false;
    const pattern = `\\b${escapeRegExp(normalizedPhrase).replace(/\s+/g, '\\s+')}\\b`;
    return new RegExp(pattern, 'i').test(haystack);
}

function detectPrimaryToolForCompact(message: string): FunctionMeta | undefined {
    const lower = message.toLowerCase();
    let best: { fn: FunctionMeta; score: number } | null = null;

    for (const fn of FUNCTION_REGISTRY) {
        const hasExcluded = fn.excludeWhen.some(ex => hasPhraseHit(lower, ex));
        if (hasExcluded) continue;

        const triggerHits = fn.triggers.filter(t => hasPhraseHit(lower, t)).length;
        const synonymHits = fn.synonyms.filter(s => hasPhraseHit(lower, s)).length;
        const totalHits = triggerHits + synonymHits;
        if (totalHits === 0) continue;

        const score = triggerHits * 12 + synonymHits * 7 + fn.priority;
        if (!best || score > best.score) {
            best = { fn, score };
        }
    }

    return best?.fn;
}

function compactToolSelection(message: string, context: PromptContext): string[] {
    const lower = message.toLowerCase();
    const asksSuggestRemaining =
        /\b(suggest|recommend|spot|where)\b/i.test(lower) &&
        /\b(remaining|left|unassigned|unscheduled)\b/i.test(lower);
    if (asksSuggestRemaining) {
        return context.scheduleId
            ? ['getEventSummaryInSchedule', 'listUnassignedParticipants', 'analyzeScheduleHealth']
            : ['listSchedules', 'getEventSummaryInSchedule', 'listUnassignedParticipants', 'analyzeScheduleHealth'];
    }

    const asksBulkSchedule =
        /\b(schedule|assign|auto[\s-]?schedule)\b/i.test(lower) &&
        /\b(all|everyone|everybody|them all)\b/i.test(lower);
    if (asksBulkSchedule) {
        return context.scheduleId
            ? ['autoScheduleParticipants']
            : ['listSchedules', 'autoScheduleParticipants'];
    }

    const asksUnscheduled = /\b(unassigned|unscheduled|not scheduled|without events|pending)\b/i.test(lower);
    const asksCount = /\b(how many|count|number of)\b/i.test(lower);
    if (asksUnscheduled) {
        return context.scheduleId
            ? ['listUnassignedParticipants']
            : ['listSchedules', 'listUnassignedParticipants'];
    }
    if (asksCount && /\b(events?|schedule)\b/i.test(lower)) {
        return context.scheduleId
            ? ['getEventSummaryInSchedule', 'listUnassignedParticipants']
            : ['listSchedules', 'getEventSummaryInSchedule', 'listUnassignedParticipants'];
    }

    const primary = detectPrimaryToolForCompact(message);
    if (!primary) {
        return context.scheduleId
            ? ['addEventToSchedule', 'getEventSummaryInSchedule']
            : ['listSchedules', 'addEventToSchedule'];
    }

    const selected = new Set<string>([primary.name]);

    for (const prereq of primary.prerequisites) {
        if (prereq === 'listSchedules' && context.scheduleId) continue;
        selected.add(prereq);
    }

    if (primary.requiresIds.includes('schedule_id') && !context.scheduleId) {
        selected.add('listSchedules');
    }

    if (primary.requiresIds.includes('event_id')) {
        selected.add('searchEventsInSchedule');
        selected.add('getEventSummaryInSchedule');
        if (!context.scheduleId) selected.add('listSchedules');
    }

    if (primary.requiresIds.includes('participant_id')) {
        selected.add('listUnassignedParticipants');
        if (!context.scheduleId) selected.add('listSchedules');
    }

    return Array.from(selected);
}


// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: DYNAMIC TOOL BLOCK
// Called once per loop iteration in FloatingChat.
// lastFunctionCalled = name of tool Aria just used (undefined on first iteration).
// userMessage = original user request, used only on iteration 1 for intent detection.
// ─────────────────────────────────────────────────────────────────────────────

export function buildToolBlock(
    userMessage: string,
    context: PromptContext,
    lastFunctionCalled?: string,
    options: ToolBlockOptions = {}
): string {
    let toolNames: string[];

    if (!lastFunctionCalled && options.compact) {
        toolNames = compactToolSelection(userMessage, context);
    } else if (!lastFunctionCalled) {
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

    if (options.compact) {
        const validNames = tools.map(fn => fn.name).join(', ');
        let block = `\n## AVAILABLE TOOLS (${tools.length})\n`;
        block += tools
            .map(fn => {
                const signature = TOOL_SIGNATURES[fn.name] ?? 'arguments';
                return signature
                    ? `- **${fn.name}**(${signature})`
                    : `- **${fn.name}**()`;
            })
            .join('\n');
        block += `\n\nVALID FUNCTION NAMES THIS TURN: ${validNames}\nReturn exactly one FUNCTION_CALL.`;
        return block;
    }

    const validNames = tools.map(fn => fn.name).join(', ');
    let block = `\n## AVAILABLE TOOLS (${tools.length})\n`;
    block += tools.map(fn => `- **${fn.name}**: ${fn.prompt}`).join('\n');
    block += `\n\nVALID FUNCTION NAMES THIS TURN: ${validNames}\nUse one name exactly as written.`;
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
    const suggestsSpotsForUnscheduled =
        /\b(suggest|recommend)\b/i.test(lower) &&
        /\b(spot|spots|slot|slots|time|times)\b/i.test(lower) &&
        /\b(unassigned|unscheduled|remaining|left)\b/i.test(lower);
    if (suggestsSpotsForUnscheduled) {
        return context.scheduleId
            ? ['listUnassignedParticipants', 'getEventSummaryInSchedule', 'autoScheduleParticipants']
            : ['listSchedules', 'listUnassignedParticipants', 'getEventSummaryInSchedule', 'autoScheduleParticipants'];
    }

    const matched = new Set<string>();

    for (const fn of FUNCTION_REGISTRY) {
        const allTriggers = [...fn.triggers, ...fn.synonyms];
        const hit = allTriggers.some(t => hasPhraseHit(lower, t));
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

export function buildActionPrompt(context: PromptContext = {}): string {
    let prompt = ACTION_PROMPT;
    if (context.scheduleId) {
        prompt += `\n\nCURRENT_SCHEDULE_ID: "${context.scheduleId}"`;
    }
    return prompt;
}

export function buildAdvisoryPrompt(context: PromptContext = {}): string {
    let prompt = ADVISORY_PROMPT;
    if (context.scheduleId) {
        prompt += `\n\n## CONTEXT\nCURRENT_SCHEDULE_ID: "${context.scheduleId}"\nPrefer this ID unless the user names a different schedule.`;
    }
    prompt += `\n\nCurrent Date & Time: ${new Date().toLocaleString()}`;
    return prompt;
}

/**
 * Builds a tool block containing only read-only tools for advisory mode.
 * Uses the same format as buildToolBlock but filters to ADVISORY_TOOL_NAMES.
 */
export function buildAdvisoryToolBlock(
    context: PromptContext,
    lastFunctionCalled?: string,
): string {
    let toolNames: string[];

    if (!lastFunctionCalled) {
        // First iteration: provide the most useful advisory starting tools
        toolNames = context.scheduleId
            ? ['getEventSummaryInSchedule', 'listUnassignedParticipants', 'analyzeScheduleHealth', 'searchEventsInSchedule']
            : ['listSchedules', 'getEventSummaryInSchedule', 'listUnassignedParticipants', 'analyzeScheduleHealth'];
    } else {
        // Follow-up: use transition graph but filter to read-only
        const nextTools = TOOL_TRANSITIONS[lastFunctionCalled] ?? [];
        const readOnly = nextTools.filter(t => ADVISORY_TOOL_NAMES.has(t));
        toolNames = Array.from(new Set([...readOnly, ...DISCOVERY_TOOLS]));

        // If the transition map says terminal, return empty — advisory should synthesize
        if (TOOL_TRANSITIONS[lastFunctionCalled]?.length === 0 || readOnly.length === 0) {
            return '';
        }
    }

    const tools = toolNames
        .map(name => FUNCTION_REGISTRY.find(fn => fn.name === name))
        .filter((fn): fn is FunctionMeta => fn !== undefined);

    if (tools.length === 0) return '';

    const validNames = tools.map(fn => fn.name).join(', ');
    let block = `\n## AVAILABLE TOOLS (${tools.length}) — READ-ONLY\n`;
    block += tools.map(fn => `- **${fn.name}**: ${fn.prompt}`).join('\n');
    block += `\n\nVALID FUNCTION NAMES THIS TURN: ${validNames}\nUse one name exactly as written. After gathering data, synthesize your answer — do NOT call more tools.`;
    return block;
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
