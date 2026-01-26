// src/lib/aria/functionRegistry.ts
// Function Registry for dynamic prompt building
// Designed for easy scaling from 14 to 25+ functions

export type FunctionCategory = 'schedule' | 'event' | 'participant';
export type RequiredId = 'schedule_id' | 'event_id' | 'participant_id';

export interface FunctionMeta {
  name: string;
  category: FunctionCategory;
  priority: number;              // Higher = more likely to be selected (1-10)
  triggers: string[];            // Primary keywords that suggest this function
  synonyms: string[];            // Secondary keywords (lower weight)
  excludeWhen: string[];         // Keywords that mean NOT this function
  requiresIds: RequiredId[];     // What IDs this function needs
  providesIds: RequiredId[];     // What IDs this function returns
  prerequisites: string[];       // Functions that should run first
  prompt: string;                // Minimal instruction for this function
  example?: string;              // Few-shot example (most effective for LLMs)
}

/**
 * Function Registry - All 14 functions with metadata for intelligent routing
 */
export const FUNCTION_REGISTRY: FunctionMeta[] = [
  // ============================================
  // Schedule Functions (7)
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
FUNCTION_CALL: {"name":"createSchedule","arguments":{"label":"Spring 2026","start_date":"2026-03-01","end_date":"2026-06-30"}}`
  },
  {
    name: 'listSchedules',
    category: 'schedule',
    priority: 10,  // High priority - often needed first
    triggers: ['list schedules', 'show schedules', 'my schedules', 'what schedules'],
    synonyms: ['view', 'see', 'get'],
    excludeWhen: ['trash', 'deleted', 'removed'],
    requiresIds: [],
    providesIds: ['schedule_id'],
    prerequisites: [],
    prompt: 'Lists all active schedules. Call this FIRST when you need a schedule_id and no CURRENT_SCHEDULE_CONTEXT is provided.',
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
    prompt: 'Lists schedules in trash. Use when user asks about deleted/trashed schedules.',
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
    prompt: 'PERMANENTLY delete ALL trashed schedules. ASK FOR CONFIRMATION FIRST!',
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
    example: `User: "Change the form deadline to tomorrow"
<thought>
User wants to update form config. I need a valid UUID for schedule_id, not a name.
</thought>
"Let me find your schedule first..."
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
[Turn 2 - After ID retrieved]
"Updating your form settings now!"
FUNCTION_CALL: {"name":"updateFormConfig","arguments":{"schedule_id":"...","form_deadline":"2026-01-26"}}`
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
    prompt: 'Checks if a date range overlaps with other schedules. Returns conflicting schedule names.',
  },

  // ============================================
  // Event Functions (4)
  // ============================================
  {
    name: 'addEventToSchedule',
    category: 'event',
    priority: 9,  // High priority - most common action
    triggers: ['add', 'create event', 'schedule', 'book', 'put', 'new lesson', 'new event'],
    synonyms: ['insert', 'place', 'set'],
    excludeWhen: ['delete', 'remove', 'cancel', 'move', 'update', 'change'],
    requiresIds: ['schedule_id'],
    providesIds: ['event_id'],
    prerequisites: ['listSchedules'],
    prompt: `Add event to schedule. Needs: schedule_id, student_name (EVENT TITLE), day, hour (24h format).
IMPORTANT: student_name is the EVENT TITLE - use exactly what user says ("Singing", "Piano lesson", "John's lesson", etc.)
REQUIRED: Must have event name, day, AND time before calling. Ask if any are missing.`,
    example: `User: "Add Singing on Friday at 4pm"
You: "Adding Singing to Friday at 4pm!"
FUNCTION_CALL: {"name":"addEventToSchedule","arguments":{"schedule_id":"...","student_name":"Singing","day":"Friday","hour":16}}`
  },
  {
    name: 'updateEventInSchedule',
    category: 'event',
    priority: 7,
    triggers: ['move event', 'change event', 'update event', 'reschedule', 'shift', 'swap'],
    synonyms: ['relocate', 'transfer', 'modify', 'switch', 'exchange'],
    excludeWhen: ['delete', 'remove', 'cancel', 'add', 'create', 'new'],
    requiresIds: ['event_id'],
    providesIds: [],
    prerequisites: ['getEventSummaryInSchedule'],
    prompt: 'Update/move an event. Needs event_id (get from getEventSummaryInSchedule first). Can change: student_name, day, hour, recurrence_rule.',
    example: `User: "Move Singing to Monday at 3pm"
You: "Let me find that event first..."
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
[After getting event_id from result]
You: "Moving Singing to Monday at 3pm!"
FUNCTION_CALL: {"name":"updateEventInSchedule","arguments":{"event_id":"abc-123","day":"Monday","hour":15}}`
  },
  {
    name: 'deleteEventFromSchedule',
    category: 'event',
    priority: 7,
    triggers: ['delete event', 'remove event', 'cancel', 'drop'],
    synonyms: ['erase', 'clear'],
    excludeWhen: ['add', 'create', 'new', 'move', 'update', 'schedule'],
    requiresIds: ['event_id'],
    providesIds: [],
    prerequisites: ['getEventSummaryInSchedule'],
    prompt: 'Delete an event. Needs event_id - MUST call getEventSummaryInSchedule first to get it.',
    example: `User: "Delete Singing on Friday"
You: "Let me find that event..."
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
[After getting result with event IDs]
You: "Deleting Singing from Friday!"
FUNCTION_CALL: {"name":"deleteEventFromSchedule","arguments":{"event_id":"abc-123"}}`
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
    prompt: 'Get all events in a schedule grouped by day. Returns event IDs needed for update/delete.',
  },
  {
    name: 'swapEvents',
    category: 'event',
    priority: 8,
    triggers: ['swap', 'switch', 'trade', 'exchange', 'shuffle'],
    synonyms: ['flip', 'rotate'],
    excludeWhen: ['delete', 'remove', 'add', 'create'],
    requiresIds: ['event_id'], // actually needs 2, but we'll mark as requiring IDs
    providesIds: [],
    prerequisites: ['getEventSummaryInSchedule'],
    prompt: 'Atomic swap of two events. Needs TWO event IDs. Call getEventSummaryInSchedule first. Much safer than moving individually.',
    example: `User: "Swap Piano and Singing"
You: "Finding events to swap..."
FUNCTION_CALL: {"name":"getEventSummaryInSchedule","arguments":{"schedule_id":"..."}}
[After IDs]
You: "Swapping Piano (id1) and Singing (id2)!"
FUNCTION_CALL: {"name":"swapEvents","arguments":{"event1_id":"abc","event2_id":"xyz"}}`
  },

  // ============================================
  // Participant Functions (3)
  // ============================================
  {
    name: 'listUnassignedParticipants',
    category: 'participant',
    priority: 6,
    triggers: ['unassigned', 'without events', 'not scheduled', 'waiting', 'pending participants'],
    synonyms: ['available', 'free'],
    excludeWhen: ['assigned', 'scheduled'],
    requiresIds: ['schedule_id'],
    providesIds: ['participant_id'],
    prerequisites: ['listSchedules'],
    prompt: 'List participants who submitted the form but have no event slot yet. Needs schedule_id.',
    example: `User: "Who hasn't been scheduled yet?"
<thought>
I need schedule_id.
</thought>
"Checking the waiting list for you..."
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}
[Turn 2 - After ID retrieved]
"Here are the unassigned students!"
FUNCTION_CALL: {"name":"listUnassignedParticipants","arguments":{"schedule_id":"..."}}`
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
    prompt: 'Get a participant\'s time preferences. Needs participant_id from listUnassignedParticipants.',
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
  {
    name: 'autoScheduleParticipants',
    category: 'schedule',
    priority: 8,
    triggers: ['schedule all', 'auto schedule', 'bulk schedule', 'assign unassigned', 'schedule everyone', 'fill schedule'],
    synonyms: ['populate', 'arrange', 'optimize'],
    excludeWhen: ['one', 'single'],
    requiresIds: ['schedule_id'],
    providesIds: [],
    prerequisites: ['listSchedules'],
    prompt: 'Automatically schedules ALL unassigned participants based on their preferences and available slots. Needs schedule_id. Equivalent to "Schedule All" button.',
    example: `User: "Schedule everyone who hasn't been assigned yet"
<thought>
User wants bulk scheduling. I need schedule_id.
</thought>
"Auto-scheduling your participants now..."
FUNCTION_CALL: {"name":"listSchedules","arguments":{}}`
  },
];

/**
 * Get functions by category
 */
export function getFunctionsByCategory(category: FunctionCategory): FunctionMeta[] {
  return FUNCTION_REGISTRY.filter(fn => fn.category === category);
}

/**
 * Get function by name
 */
export function getFunctionByName(name: string): FunctionMeta | undefined {
  return FUNCTION_REGISTRY.find(fn => fn.name === name);
}

/**
 * Get all function names
 */
export function getAllFunctionNames(): string[] {
  return FUNCTION_REGISTRY.map(fn => fn.name);
}

/**
 * Get functions that provide a specific ID type
 */
export function getFunctionsProvidingId(idType: RequiredId): FunctionMeta[] {
  return FUNCTION_REGISTRY.filter(fn => fn.providesIds.includes(idType));
}
