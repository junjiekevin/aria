// src/lib/aria/functionRegistry.ts
// Function registry for dynamic prompt building.
// All RRULE examples use correct iCal format:
//   Weekly:   FREQ=WEEKLY;BYDAY=MO
//   Biweekly: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
//   Monthly:  FREQ=MONTHLY;BYDAY=2MO  (nth weekday of month)
//   Daily:    FREQ=DAILY
//   Once:     "" (empty string)

export type FunctionCategory = 'event' | 'participant';
export type RequiredId = 'calendar_id' | 'legacy_schedule_id' | 'event_id' | 'participant_id' | 'plan_id';

export interface FunctionMeta {
    name: string;
    category: FunctionCategory;
    priority: number;
    triggers: string[];
    synonyms: string[];
    excludeWhen: string[];
    requiresIds: RequiredId[];
    providesIds: RequiredId[];
    prerequisites: string[];
    prompt: string;
    example?: string;
}

export const FUNCTION_REGISTRY: FunctionMeta[] = [

    // ============================================
    // Calendar Event Tools (canonical path via calendar-workspace → apps/api)
    // Legacy schedule CRUD tools retired from active assistant surface in BLD-012.
    // ============================================

    {
        name: 'listSchedules',
        category: 'event',
        priority: 9,
        triggers: ['list calendars', 'show calendars', 'which calendars', 'my calendars', 'list schedules'],
        synonyms: ['calendar list', 'available calendars'],
        excludeWhen: [],
        requiresIds: [],
        providesIds: ['calendar_id'],
        prerequisites: [],
        prompt: 'List synced provider calendars available in the current workspace. Use this to resolve calendar_id for canonical calendar-event tools.',
    },

    {
        name: 'analyzeScheduleHealth',
        category: 'event',
        priority: 7,
        triggers: ['audit schedule', 'how is my schedule', 'analyze', 'spot issues', 'health check', 'gaps'],
        synonyms: ['review', 'inspect'],
        excludeWhen: [],
        requiresIds: [],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: 'Analyzes the current calendar for gaps, overlaps, or low utilization. Call this to give the user advice.',
    },

    // ============================================
    // Agentic Plan Tools (Plan → Confirm → Execute)
    // ============================================

    {
        name: 'proposeScheduleChanges',
        category: 'event',
        priority: 10,
        triggers: ['plan', 'propose', 'preview', 'what if', 'dry run', 'show me first', 'before you do', 'draft changes'],
        synonyms: ['suggest', 'outline'],
        excludeWhen: ['commit', 'confirm', 'apply'],
        requiresIds: [],
        providesIds: ['plan_id'],
        prerequisites: [],
        prompt: 'Propose multi-step calendar changes as a dry-run preview without modifying events. Required: changes[] ({action: "add"|"move"|"swap"|"delete", target, description, before?, after?}). Returns plan_id for commitSchedulePlan.',
    },

    {
        name: 'commitSchedulePlan',
        category: 'event',
        priority: 10,
        triggers: ['commit', 'confirm', 'apply', 'yes do it', 'go ahead', 'approve', 'looks good', 'execute plan'],
        synonyms: ['accept', 'proceed', 'finalize'],
        excludeWhen: ['propose', 'preview', 'what if'],
        requiresIds: ['plan_id'],
        providesIds: [],
        prerequisites: ['proposeScheduleChanges'],
        prompt: 'Execute a proposed plan. Required: plan_id from proposeScheduleChanges. Only call after user confirms.',
    },

    // ============================================
    // Event Functions
    // ============================================

    {
        name: 'addEventToSchedule',
        category: 'event',
        priority: 9,
        triggers: ['add', 'create event', 'schedule', 'book', 'put', 'new lesson', 'new event'],
        synonyms: ['insert', 'place', 'set'],
        excludeWhen: ['delete', 'remove', 'cancel', 'move', 'update', 'change'],
        requiresIds: ['calendar_id'],
        providesIds: ['event_id'],
        prerequisites: ['listSchedules'],
        prompt: 'Add an event. Required: calendar_id, student_name, day (full English: "Monday" etc.), hour (24h integer), recurrence_rule (see RECURRENCE FORMAT above).',
    },

    {
        name: 'updateEventInSchedule',
        category: 'event',
        priority: 7,
        triggers: ['move event', 'change event', 'update event', 'reschedule', 'shift', 'rename event', 'move', 'change', 'update'],
        synonyms: ['relocate', 'transfer', 'modify', 'change it', 'make it'],
        excludeWhen: ['delete', 'remove', 'cancel', 'add', 'create', 'new', 'swap', 'switch'],
        requiresIds: ['event_id'],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: `Update or move an event. Needs event_id — call getEventSummaryInSchedule first.
Can change: student_name, day (full English name: "Monday", "Tuesday" etc.), hour (24h integer), recurrence_rule.

IMPORTANT: When changing ONLY the frequency, pass ONLY event_id and recurrence_rule. Do NOT pass day or hour.

RECURRENCE RULES — use EXACTLY these formats:
- Once:     "" (empty string)
- Daily:    "FREQ=DAILY"
- Weekly:   "FREQ=WEEKLY;BYDAY=XX"
- Biweekly: "FREQ=WEEKLY;INTERVAL=2;BYDAY=XX"
- Monthly:  "FREQ=MONTHLY;BYDAY=NXX"  e.g. "FREQ=MONTHLY;BYDAY=2TU" for 2nd Tuesday`,
example: `User: "Change Piano to biweekly"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"calendar_id":"..."}}
[Piano found on Tuesday]
FUNCTION_CALL: {"name":"updateEventInSchedule","arguments":{"event_id":"...","recurrence_rule":"FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"}}

User: "Move Singing to Thursdays at 4pm"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"calendar_id":"..."}}
[After getting event_id]
FUNCTION_CALL: {"name":"updateEventInSchedule","arguments":{"event_id":"...","day":"Thursday","hour":16}}`,
    },

    {
        name: 'deleteEventFromSchedule',
        category: 'event',
        priority: 7,
        triggers: ['delete event', 'remove event', 'cancel event', 'drop event', 'delete', 'remove'],
        synonyms: ['erase', 'clear'],
        excludeWhen: ['add', 'create', 'new', 'move', 'update', 'schedule'],
        requiresIds: ['event_id'],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: 'Delete an event permanently. Needs event_id — call getEventSummaryInSchedule first. If no CURRENT_CALENDAR_ID is in context, call listSchedules first and ask the user which calendar the event is in.',
        example: `User: "Delete Singing on Friday"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"calendar_id":"..."}}
[After getting event_id]
FUNCTION_CALL: {"name":"deleteEventFromSchedule","arguments":{"event_id":"..."}}`,
    },

    {
        name: 'getEventSummaryInSchedule',
        category: 'event',
        priority: 8,
        triggers: ['show events', 'list events', 'what events', "what's scheduled", 'view events'],
        synonyms: ['see events', 'get events', 'summary'],
        excludeWhen: [],
        requiresIds: ['calendar_id'],
        providesIds: ['event_id'],
        prerequisites: ['listSchedules'],
        prompt: '**PREFERRED FOR FINDING SPECIFIC EVENTS.** Get full schedule grouped by day. Minified keys: i (id), n (name), t (time), r (rule).',
    },

    {
        name: 'searchEventsInSchedule',
        category: 'event',
        priority: 10,
        triggers: ['find event', 'search event', 'locate', 'where is', 'look for'],
        synonyms: ['query', 'find'],
        excludeWhen: [],
        requiresIds: ['calendar_id'],
        providesIds: ['event_id'],
        prerequisites: ['listSchedules'],
        prompt: 'Search for specific events by student name. Required: calendar_id, query (string — the name to search for). If no CURRENT_CALENDAR_ID is in context, call listSchedules first and ask the user which calendar to search in.',
    },

    {
        name: 'swapEvents',
        category: 'event',
        priority: 8,
        triggers: ['swap', 'switch', 'trade', 'exchange', 'shuffle'],
        synonyms: ['flip', 'rotate'],
        excludeWhen: ['delete', 'remove', 'add', 'create'],
        requiresIds: ['event_id'],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: 'Atomically swaps two events including their recurrence rules. Requires event1_id and event2_id. Call getEventSummaryInSchedule first to find these specific IDs.',
        example: `User: "Swap Piano and Singing"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"calendar_id":"..."}}
[After getting both IDs]
FUNCTION_CALL: {"name":"swapEvents","arguments":{"event1_id":"...","event2_id":"..."}}`,
    },

    // ============================================
    // Participant Functions
    // ============================================

    {
        name: 'listUnassignedParticipants',
        category: 'participant',
        priority: 6,
        triggers: ['unassigned', 'unscheduled', 'without events', 'not scheduled', 'waiting', 'pending'],
        synonyms: ['available', 'free'],
        excludeWhen: ['assigned', 'scheduled'],
        requiresIds: ['legacy_schedule_id'],
        providesIds: ['participant_id'],
        prerequisites: [],
        prompt: 'List participants who submitted the form but have no event slot yet. Needs legacy_schedule_id (legacy schedule domain id).',
        example: `User: "Who hasn't been scheduled yet?"
<thought>I need a legacy schedule id from context.</thought>
FUNCTION_CALL: {"name":"listUnassignedParticipants","arguments":{"legacy_schedule_id":"..."}}`,
    },

    {
        name: 'getParticipantPreferences',
        category: 'participant',
        priority: 5,
        triggers: ['preferences', 'availability', 'when can', 'preferred times'],
        synonyms: ['wants', 'prefers'],
        excludeWhen: [],
        requiresIds: ['participant_id'],
        providesIds: [],
        prerequisites: ['listUnassignedParticipants'],
        prompt: "Get a participant's time preferences. Needs participant_id from listUnassignedParticipants.",
    },

    {
        name: 'markParticipantAssigned',
        category: 'participant',
        priority: 4,
        triggers: ['mark assigned', 'mark as assigned', 'mark scheduled'],
        synonyms: ['complete', 'done'],
        excludeWhen: [],
        requiresIds: ['participant_id'],
        providesIds: [],
        prerequisites: ['listUnassignedParticipants'],
        prompt: 'Mark a participant as assigned (true) or unassigned (false). Needs participant_id and assigned boolean.',
    },

];

// ============================================
// Accessors
// ============================================

export function getFunctionsByCategory(category: FunctionCategory): FunctionMeta[] {
    return FUNCTION_REGISTRY.filter(fn => fn.category === category);
}

export function getFunctionByName(name: string): FunctionMeta | undefined {
    return FUNCTION_REGISTRY.find(fn => fn.name === name);
}

export function getAllFunctionNames(): string[] {
    return FUNCTION_REGISTRY.map(fn => fn.name);
}

export function getFunctionsProvidingId(idType: RequiredId): FunctionMeta[] {
    return FUNCTION_REGISTRY.filter(fn => fn.providesIds.includes(idType));
}
