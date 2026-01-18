// src/lib/functions.ts
// Function definitions for AI function calling

import { 
  createSchedule, 
  getSchedules, 
  updateSchedule, 
  deleteSchedule, 
  activateSchedule,
  archiveSchedule,
  restoreSchedule,
  permanentDeleteSchedule,
  permanentDeleteAllTrashed,
  getAllSchedules,
  type CreateScheduleInput,
  type UpdateScheduleInput 
} from './api/schedules';

/**
 * Function schema definitions for OpenRouter/AI
 * These tell the AI what functions it can call and what parameters they need
 */
export const FUNCTION_DEFINITIONS = [
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
    name: 'createMultipleSchedules',
    description: 'Create multiple schedules at once. Use this when the user asks to create 2 or more schedules.',
    parameters: {
      type: 'object',
      properties: {
        schedules: {
          type: 'array',
          description: 'Array of schedule objects to create',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              start_date: { type: 'string' },
              end_date: { type: 'string' },
            },
          },
        },
      },
      required: ['schedules'],
    },
  },
  {
    name: 'listSchedules',
    description: 'Get all schedules for the current user (excludes trashed items)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'updateSchedule',
    description: 'Update an existing schedule (change label, dates, or status)',
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
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'activateSchedule',
    description: 'Activate a draft schedule to start collecting student responses',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to activate',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'archiveSchedule',
    description: 'Archive a completed schedule (no longer collecting responses)',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to archive',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'deleteSchedule',
    description: 'Move a schedule to trash (soft delete, can be restored within 14 days)',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to delete',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'deleteAllSchedules',
    description: 'Move ALL schedules to trash (soft delete, can be restored within 30 days)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'recoverSchedule',
    description: 'Restore a trashed schedule to its previous status. Can only be used on schedules that are in trash.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the trashed schedule to recover',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'permanentDeleteSchedule',
    description: 'Permanently delete a schedule from the database (cannot be recovered). Only use when user explicitly requests hard delete.',
    parameters: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'The ID of the schedule to permanently delete',
        },
      },
      required: ['schedule_id'],
    },
  },
  {
    name: 'permanentDeleteAllTrashed',
    description: 'Permanently delete ALL trashed schedules from the database (cannot be recovered). Only use when user explicitly requests to empty trash.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'listAllSchedules',
    description: 'Get ALL schedules including trashed items (for comprehensive listing)',
    parameters: {
      type: 'object',
      properties: {},
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

      case 'createMultipleSchedules': {
        const schedules = args.schedules as Array<CreateScheduleInput>;
        
        // Create each schedule sequentially (to show progress)
        const createdSchedules = [];
        for (const scheduleInput of schedules) {
          const schedule = await createSchedule(scheduleInput);
          createdSchedules.push(schedule);
        }
        
        return { 
          success: true, 
          data: {
            schedules: createdSchedules,
            count: createdSchedules.length,
          },
        };
      }

      case 'listSchedules': {
        const schedules = await getSchedules();
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

      case 'activateSchedule': {
        await activateSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule activated successfully' },
        };
      }

      case 'archiveSchedule': {
        await archiveSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule archived successfully' },
        };
      }

      case 'deleteSchedule': {
        await deleteSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule moved to trash' },
        };
      }

      case 'deleteAllSchedules': {
        // Get all schedules first
        const schedules = await getSchedules();
        
        // Delete each one
        const deletePromises = schedules.map(schedule => deleteSchedule(schedule.id));
        await Promise.all(deletePromises);
        
        return { 
          success: true, 
          data: { 
            message: `Moved ${schedules.length} schedule${schedules.length > 1 ? 's' : ''} to trash`,
            count: schedules.length 
          },
        };
      }

      case 'recoverSchedule': {
        await restoreSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule restored from trash' },
        };
      }

      case 'permanentDeleteSchedule': {
        await permanentDeleteSchedule(args.schedule_id);
        return { 
          success: true, 
          data: { message: 'Schedule permanently deleted' },
        };
      }

      case 'permanentDeleteAllTrashed': {
        const result = await permanentDeleteAllTrashed();
        return { 
          success: true, 
          data: { 
            message: `Permanently deleted ${result.count} trashed schedule${result.count > 1 ? 's' : ''}`,
            count: result.count 
          },
        };
      }

      case 'listAllSchedules': {
        const schedules = await getAllSchedules();
        return { 
          success: true, 
          data: schedules,
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
