// src/lib/aria/functionRegistry.ts
// Function registry for dynamic prompt building.
// All RRULE examples use correct iCal format:
//   Weekly:   FREQ=WEEKLY;BYDAY=MO
//   Biweekly: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
//   Monthly:  FREQ=MONTHLY;BYDAY=2MO  (nth weekday of month)
//   Daily:    FREQ=DAILY
//   Once:     "" (empty string)

export type FunctionCategory = 'schedule' | 'event' | 'participant';
export type RequiredId = 'schedule_id' | 'event_id' | 'participant_id';

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
    // Schedule Functions
    // ============================================

    {
        name: 'createSchedule',
        category: 'schedule',
        priority: 7,
        triggers: ['create schedule', 'new schedule', 'make schedule', 'start schedule'],
        synonyms: ['set up', 'begin', 'initialize'],
        excludeWhen: ['event', 'lesson', 'appointment'],
        requiresIds: [],
        providesIds: ['schedule_id'],
        prerequisites: [],
        prompt: 'Create a new schedule with label, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD).',
        example: `User: "Create a schedule for Spring 2026 from March to June"
You: "Creating your Spring 2026 schedule!"
FUNCTION_CALL: {"name":"createSchedule","arguments":{"label":"Spring 2026","start_date":"2026-03-01","end_date":"2026-06-30"}}`,
    },

    {
        name: 'listSchedules',
        category: 'schedule',
        priority: 10,
        triggers: ['list schedules', 'show schedules', 'my schedules', 'what schedules'],
        synonyms: ['view', 'see', 'get'],
        excludeWhen: ['trash', 'deleted', 'removed'],
        requiresIds: [],
        providesIds: ['schedule_id'],
        prerequisites: [],
        prompt: 'Lists all active schedules. Call this FIRST when you need a schedule_id and no CURRENT_SCHEDULE_ID is provided.',
    },

    {
        name: 'listTrashedSchedules',
        category: 'schedule',
        priority: 5,
        triggers: ['trashed', 'deleted schedules', 'trash', 'removed schedules'],
        synonyms: ['bin', 'recycle'],
        excludeWhen: ['active', 'current'],
        requiresIds: [],
        providesIds: ['schedule_id'],
        prerequisites: [],
        prompt: 'Lists schedules in trash. Use when user asks about deleted or trashed schedules.',
    },

    {
        name: 'updateSchedule',
        category: 'schedule',
        priority: 6,
        triggers: ['update schedule', 'change schedule', 'edit schedule', 'rename schedule', 'modify schedule', 'change hours', 'operating hours'],
        synonyms: ['alter', 'adjust'],
        excludeWhen: ['event', 'lesson', 'delete', 'trash'],
        requiresIds: ['schedule_id'],
        providesIds: [],
        prerequisites: ['listSchedules'],
        prompt: 'Update schedule label, dates, working_hours_start (0-23), working_hours_end (0-23). Needs schedule_id.',
    },

    {
        name: 'trashSchedule',
        category: 'schedule',
        priority: 6,
        triggers: ['trash schedule', 'delete schedule', 'remove schedule'],
        synonyms: ['discard', 'get rid of'],
        excludeWhen: ['event', 'lesson', 'recover', 'restore'],
        requiresIds: ['schedule_id'],
        providesIds: [],
        prerequisites: ['listSchedules'],
        prompt: 'Move schedule to trash (soft delete, recoverable). Needs schedule_id.',
    },

    {
        name: 'recoverSchedule',
        category: 'schedule',
        priority: 5,
        triggers: ['recover', 'restore', 'undelete', 'bring back'],
        synonyms: ['undo delete', 'retrieve'],
        excludeWhen: ['create', 'new'],
        requiresIds: ['schedule_id'],
        providesIds: [],
        prerequisites: ['listTrashedSchedules'],
        prompt: 'Restore a schedule from trash. Call listTrashedSchedules first to get the ID.',
    },

    {
        name: 'emptyTrash',
        category: 'schedule',
        priority: 3,
        triggers: ['empty trash', 'clear trash', 'permanently delete', 'delete all trash'],
        synonyms: ['purge', 'wipe'],
        excludeWhen: ['recover', 'restore'],
        requiresIds: [],
        providesIds: [],
        prerequisites: [],
        prompt: 'PERMANENTLY deletes ALL trashed schedules. ASK FOR CONFIRMATION before calling this.',
    },

    {
        name: 'updateFormConfig',
        category: 'schedule',
        priority: 5,
        triggers: ['configure form', 'form instructions', 'form deadline', 'max choices', 'change form'],
        synonyms: ['setup form', 'instructions', 'deadline'],
        excludeWhen: ['event', 'lesson'],
        requiresIds: ['schedule_id'],
        providesIds: [],
        prerequisites: ['listSchedules'],
        prompt: 'Update form settings: max_choices (1-3), form_instructions, form_deadline (YYYY-MM-DD), working_hours_start, working_hours_end.',
        example: `User: "Change the form deadline to March 1st"
<thought>I need a schedule_id. Fetching schedules first.</thought>
"Let me find your schedule..."
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
[After ID retrieved]
"Updating the deadline now!"
FUNCTION_CALL: {"name":"updateFormConfig","arguments":{"schedule_id":"...","form_deadline":"2026-03-01"}}`,
    },

    {
        name: 'checkScheduleOverlaps',
        category: 'schedule',
        priority: 6,
        triggers: ['check overlaps', 'clash', 'conflict', 'overlap', 'double booked'],
        synonyms: ['audit', 'verify dates'],
        excludeWhen: [],
        requiresIds: [],
        providesIds: [],
        prerequisites: [],
        prompt: 'Checks if a date range overlaps with existing schedules. Returns conflicting schedule names.',
    },

    {
        name: 'autoScheduleParticipants',
        category: 'schedule',
        priority: 8,
        triggers: ['schedule all', 'auto schedule', 'bulk schedule', 'assign everyone', 'schedule everyone', 'fill schedule'],
        synonyms: ['populate', 'arrange', 'optimize'],
        excludeWhen: ['one', 'single'],
        requiresIds: ['schedule_id'],
        providesIds: [],
        prerequisites: ['listSchedules'],
        prompt: 'Automatically schedules ALL unassigned participants based on their preferences. Equivalent to the "Schedule All" button. Needs schedule_id.',
        example: `User: "Schedule everyone"
<thought>I need schedule_id.</thought>
"Auto-scheduling your participants now..."
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
[After ID retrieved]
FUNCTION_CALL: {"name":"autoScheduleParticipants","arguments":{"schedule_id":"..."}}`,
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
        requiresIds: ['schedule_id'],
        providesIds: ['event_id'],
        prerequisites: ['listSchedules'],
        prompt: `Add an event to a schedule. Required: schedule_id, student_name (the event title), day, hour (24h), recurrence_rule.

RECURRENCE RULES — use EXACTLY these formats:
- Once:     "" (empty string)
- Daily:    "FREQ=DAILY"
- Weekly:   "FREQ=WEEKLY;BYDAY=XX"       where XX = MO TU WE TH FR SA SU
- Biweekly: "FREQ=WEEKLY;INTERVAL=2;BYDAY=XX"
- Monthly:  "FREQ=MONTHLY;BYDAY=NXX"     where N = week number (1-4), XX = day abbrev
            e.g. 2nd Tuesday = "FREQ=MONTHLY;BYDAY=2TU"

IMPORTANT: ALWAYS ask the user to confirm frequency if not explicitly stated.
Ask: "Would you like this to be Once, Daily, Weekly, Bi-Weekly, or Monthly?"`,
        example: `User: "Add Piano on Tuesdays at 3pm weekly"
FUNCTION_CALL: {"name":"addEventToSchedule","arguments":{"schedule_id":"...","student_name":"Piano","day":"Tuesday","hour":15,"recurrence_rule":"FREQ=WEEKLY;BYDAY=TU"}}

User: "Add Singing on the 2nd Monday of each month at 10am"
FUNCTION_CALL: {"name":"addEventToSchedule","arguments":{"schedule_id":"...","student_name":"Singing","day":"Monday","hour":10,"recurrence_rule":"FREQ=MONTHLY;BYDAY=2MO"}}

User: "Add a one-time Guitar session on Friday at 2pm"
FUNCTION_CALL: {"name":"addEventToSchedule","arguments":{"schedule_id":"...","student_name":"Guitar","day":"Friday","hour":14,"recurrence_rule":""}}`,
    },

    {
        name: 'updateEventInSchedule',
        category: 'event',
        priority: 7,
        triggers: ['move event', 'change event', 'update event', 'reschedule', 'shift', 'rename event'],
        synonyms: ['relocate', 'transfer', 'modify'],
        excludeWhen: ['delete', 'remove', 'cancel', 'add', 'create', 'new', 'swap', 'switch'],
        requiresIds: ['event_id'],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: `Update or move an event. Needs event_id — call getEventSummaryInSchedule first.
Can change: student_name, day, hour, recurrence_rule.

IMPORTANT: When changing ONLY the frequency, pass ONLY event_id and recurrence_rule. Do NOT pass day or hour.

RECURRENCE RULES — use EXACTLY these formats:
- Once:     "" (empty string)
- Daily:    "FREQ=DAILY"
- Weekly:   "FREQ=WEEKLY;BYDAY=XX"
- Biweekly: "FREQ=WEEKLY;INTERVAL=2;BYDAY=XX"
- Monthly:  "FREQ=MONTHLY;BYDAY=NXX"  e.g. "FREQ=MONTHLY;BYDAY=2TU" for 2nd Tuesday`,
        example: `User: "Change Piano to biweekly"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
[Piano found on Tuesday]
FUNCTION_CALL: {"name":"updateEventInSchedule","arguments":{"event_id":"...","recurrence_rule":"FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"}}

User: "Move Singing to Thursdays at 4pm"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
[After getting event_id]
FUNCTION_CALL: {"name":"updateEventInSchedule","arguments":{"event_id":"...","day":"Thursday","hour":16}}`,
    },

    {
        name: 'deleteEventFromSchedule',
        category: 'event',
        priority: 7,
        triggers: ['delete event', 'remove event', 'cancel event', 'drop event'],
        synonyms: ['erase', 'clear'],
        excludeWhen: ['add', 'create', 'new', 'move', 'update', 'schedule'],
        requiresIds: ['event_id'],
        providesIds: [],
        prerequisites: ['getEventSummaryInSchedule'],
        prompt: 'Delete an event permanently. Needs event_id — call getEventSummaryInSchedule first.',
        example: `User: "Delete Singing on Friday"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
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
        requiresIds: ['schedule_id'],
        providesIds: ['event_id'],
        prerequisites: ['listSchedules'],
        prompt: 'Get all events grouped by day with their IDs. Call this before any update, delete, or swap.',
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
        prompt: 'Atomically swaps two events including their recurrence rules. Needs TWO event IDs. Call getEventSummaryInSchedule first.',
        example: `User: "Swap Piano and Singing"
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
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
        triggers: ['unassigned', 'without events', 'not scheduled', 'waiting', 'pending'],
        synonyms: ['available', 'free'],
        excludeWhen: ['assigned', 'scheduled'],
        requiresIds: ['schedule_id'],
        providesIds: ['participant_id'],
        prerequisites: ['listSchedules'],
        prompt: 'List participants who submitted the form but have no event slot yet. Needs schedule_id.',
        example: `User: "Who hasn't been scheduled yet?"
<thought>I need schedule_id.</thought>
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
[After ID retrieved]
FUNCTION_CALL: {"name":"listUnassignedParticipants","arguments":{"schedule_id":"..."}}`,
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
