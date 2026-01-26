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
  swapEvents, // New import
  deleteEventFromSchedule,
  getEventSummaryInSchedule,
  listUnassignedParticipants,
  getParticipantPreferences,
  markParticipantAssigned,
  updateFormConfig,
  checkScheduleOverlaps,
  autoScheduleParticipants,
  type CreateScheduleInput,
  type UpdateScheduleInput
} from './api/schedules';

/**
 * Function schema definitions for OpenRouter/AI
 * These tell the AI what functions it can call and what parameters they need
 */


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

      case 'updateFormConfig': {
        const { schedule_id, ...config } = args;
        const result = await updateFormConfig(schedule_id, config);
        return {
          success: true,
          data: result,
        };
      }

      case 'checkScheduleOverlaps': {
        const { start_date, end_date, exclude_id } = args;
        const result = await checkScheduleOverlaps(start_date, end_date, exclude_id);
        return {
          success: true,
          data: result,
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

      case 'swapEvents': {
        if (!args.event1_id || !args.event2_id) {
          throw new Error('Missing event IDs. You must provide both event1_id and event2_id. Call getEventSummaryInSchedule first to find them.');
        }
        const events = await swapEvents(args.event1_id, args.event2_id);
        return {
          success: true,
          data: { message: 'Events swapped successfully', events }
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

      case 'autoScheduleParticipants': {
        // Default to preview mode (commit=false) so UI can show the confirmation modal
        const result = await autoScheduleParticipants(args.schedule_id, false);
        return {
          success: true,
          data: result,
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
