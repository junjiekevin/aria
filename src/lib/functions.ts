// src/lib/functions.ts
// Function definitions for AI function calling

import { 
  createSchedule, 
  getSchedules, 
  updateSchedule,
  trashSchedule,
  recoverSchedule,
  emptyTrash,
  getTrashedSchedules as listTrashedSchedules,
  addEventToSchedule,
  updateEventInSchedule,
  deleteEventFromSchedule,
  getEventSummaryInSchedule,
  listUnassignedParticipants,
  getParticipantPreferences,
  markParticipantAssigned,
  type CreateScheduleInput,
  type UpdateScheduleInput 
} from './api/schedules';

/**
 * Function schema definitions for OpenRouter/AI
 * These tell the AI what functions it can call and what parameters they need
 */
export const FUNCTION_DEFINITIONS = [
  // ============================================
  // Schedule Functions
  // ============================================
  {
    name: 'createSchedule',
    description: 'Create a new schedule for lessons or appointments. The schedule starts as a draft.',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'A descriptive name for the schedule (e.g., "Fall 2026 Piano Lessons")',
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (e.g., "2026-09-01")',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (e.g., "2026-12-15")',
        },
      },
      required: ['label', 'start_date', 'end_date'],
    },
  },
  {
    name: 'listSchedules',
    description: 'Get all active schedules for the current user (excludes trashed items). Always call this first to get schedule IDs.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'listTrashedSchedules',
    description: 'List all schedules that are in trash. Use this when user asks about trashed or deleted schedules.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'updateSchedule',
    description: 'Update an existing schedule. Can change label, dates, or status. Status can be: "draft", "collecting" (activate), "archived", or "trashed" (delete).',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to update',
        },
        label: {
          type: 'string',
          description: 'New label/name for the schedule (optional)',
        },
        start_date: {
          type: 'string',
          description: 'New start date in YYYY-MM-DD format (optional)',
        },
        end_date: {
          type: 'string',
          description: 'New end date in YYYY-MM-DD format (optional)',
        },
        status: {
          type: 'string',
          description: 'New status: "draft", "collecting", "archived", or "trashed" (optional)',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'trashSchedule',
    description: 'Move a schedule to trash (soft delete). Schedules in trash can be recovered within 30 days. Use listSchedules to get the schedule ID first.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The UUID ID of the schedule to move to trash',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'recoverSchedule',
    description: 'Restore a trashed schedule to its previous status. Use listTrashedSchedules to get the schedule ID first.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The UUID ID of the trashed schedule to recover',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'emptyTrash',
    description: 'Permanently delete ALL trashed schedules. This action cannot be undone. Always ask for confirmation first.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // ============================================
  // Event Functions
  // ============================================
  {
    name: 'addEventToSchedule',
    description: 'Add an event/lesson to a schedule. Specify student name, day, and hour (24-hour format, e.g., 15 for 3pm).',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to add the event to',
        },
        student_name: {
          type: 'string',
          description: 'Name of the student/participant for this event',
        },
        day: {
          type: 'string',
          description: 'Day of the week (e.g., "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")',
        },
        hour: {
          type: 'integer',
          description: 'Hour in 24-hour format (0-23). For example: 15 for 3pm, 9 for 9am, 14 for 2pm.',
        },
        start_time: {
          type: 'string',
          description: 'Optional. Start time in HH:MM format. Defaults to hour:00 if not specified.',
        },
        end_time: {
          type: 'string',
          description: 'Optional. End time in HH:MM format. Defaults to hour+1:00 if not specified.',
        },
        recurrence_rule: {
          type: 'string',
          description: 'Optional. For recurring events, use RRULE format like "FREQ=WEEKLY;BYDAY=MO" for every Monday.',
        },
      },
      required: ['schedule_id', 'student_name', 'day', 'hour'],
    },
  },
  {
    name: 'updateEventInSchedule',
    description: 'Update or move an event in a schedule. Can change student name, day, hour, or time. Use this to move events around.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The ID of the event to update',
        },
        student_name: {
          type: 'string',
          description: 'New student name (optional - omit to keep current)',
        },
        day: {
          type: 'string',
          description: 'New day of the week (optional - omit to keep current)',
        },
        hour: {
          type: 'integer',
          description: 'New hour in 24-hour format (optional - omit to keep current)',
        },
        start_time: {
          type: 'string',
          description: 'Optional. New start time in HH:MM format.',
        },
        end_time: {
          type: 'string',
          description: 'Optional. New end time in HH:MM format.',
        },
        recurrence_rule: {
          type: 'string',
          description: 'Optional. New recurrence rule.',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'deleteEventFromSchedule',
    description: 'Remove an event from a schedule.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The ID of the event to delete',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'getEventSummaryInSchedule',
    description: 'Get a brief summary of all events in a schedule, grouped by day. Shows student name and time only.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to get events from',
        },
      },
      required: ['schedule_id'],
    },
  },
  // ============================================
  // Participant Functions
  // ============================================
  {
    name: 'listUnassignedParticipants',
    description: 'List all participants who have not been assigned to any event in a schedule. These are people who submitted the form but dont have a time slot yet.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to check',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'getParticipantPreferences',
    description: 'Get the time preferences for a specific participant. Shows their preferred days, times, and frequency.',
    parameters: {
      type: 'object',
      properties: {
        participant_id: {
          type: 'string',
          description: 'The ID of the participant',
        },
      },
      required: ['participant_id'],
    },
  },
  {
    name: 'markParticipantAssigned',
    description: 'Mark a participant as assigned (or unassigned). Use this after assigning them to an event.',
    parameters: {
      type: 'object',
      properties: {
        participant_id: {
          type: 'string',
          description: 'The ID of the participant',
        },
        assigned: {
          type: 'boolean',
          description: 'True to mark as assigned, false to mark as unassigned',
        },
      },
      required: ['participant_id', 'assigned'],
    },
  },
];

/**
 * Execute a function called by the AI
 */
export async function executeFunction(
  functionName: string,
  args: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (functionName) {
      // ============================================
      // Schedule Functions
      // ============================================
      case 'createSchedule': {
        const input: CreateScheduleInput = {
          label: args.label,
          start_date: args.start_date,
          end_date: args.end_date,
        };
        const schedule = await createSchedule(input);
        return { 
          success: true, 
          data: schedule,
        };
      }

      case 'listSchedules': {
        const schedules = await getSchedules();
        return { 
          success: true, 
          data: schedules,
        };
      }

      case 'listTrashedSchedules': {
        const schedules = await listTrashedSchedules();
        return { 
          success: true, 
          data: schedules,
        };
      }

      case 'updateSchedule': {
        const { schedule_id, ...updates } = args;
        const updatedSchedule = await updateSchedule(schedule_id, updates as UpdateScheduleInput);
        return { 
          success: true, 
          data: updatedSchedule,
        };
      }

      case 'trashSchedule': {
        await trashSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule moved to trash' },
        };
      }

      case 'recoverSchedule': {
        await recoverSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule restored from trash' },
        };
      }

      case 'emptyTrash': {
        const result = await emptyTrash();
        return { 
          success: true, 
          data: { message: `Permanently deleted ${result.count || 0} schedules from trash` },
        };
      }

      // ============================================
      // Event Functions
      // ============================================
      case 'addEventToSchedule': {
        const event = await addEventToSchedule({
          schedule_id: args.schedule_id,
          student_name: args.student_name,
          day: args.day,
          hour: args.hour,
          start_time: args.start_time,
          end_time: args.end_time,
          recurrence_rule: args.recurrence_rule,
        });
        return { 
          success: true, 
          data: event,
        };
      }

      case 'updateEventInSchedule': {
        const event = await updateEventInSchedule({
          event_id: args.event_id,
          student_name: args.student_name,
          day: args.day,
          hour: args.hour,
          start_time: args.start_time,
          end_time: args.end_time,
          recurrence_rule: args.recurrence_rule,
        });
        return { 
          success: true, 
          data: event,
        };
      }

      case 'deleteEventFromSchedule': {
        await deleteEventFromSchedule({ event_id: args.event_id });
        return { 
          success: true, 
          data: { message: 'Event deleted' },
        };
      }

      case 'getEventSummaryInSchedule': {
        const summary = await getEventSummaryInSchedule(args.schedule_id);
        return { 
          success: true, 
          data: summary,
        };
      }

      // ============================================
      // Participant Functions
      // ============================================
      case 'listUnassignedParticipants': {
        const participants = await listUnassignedParticipants(args.schedule_id);
        return { 
          success: true, 
          data: participants,
        };
      }

      case 'getParticipantPreferences': {
        const preferences = await getParticipantPreferences(args.participant_id);
        return { 
          success: true, 
          data: preferences,
        };
      }

      case 'markParticipantAssigned': {
        await markParticipantAssigned(args.participant_id, args.assigned);
        return { 
          success: true, 
          data: { message: args.assigned ? 'Participant marked as assigned' : 'Participant marked as unassigned' },
        };
      }

      default:
        return { 
          success: false, 
          error: `Unknown function: ${functionName}` 
        };
    }
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
