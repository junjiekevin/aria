// src/lib/functions.ts
// AI function execution layer.
// Calls services only — never imports from api/* directly.
// Wraps all executions with deduplication to prevent AI double-fire.

import { withDedup } from './retry';
import { toAriaError } from './errors';

import {
    createSchedule,
    getSchedules,
    getAllSchedules,
    getTrashedSchedules,
    updateSchedule,
    trashSchedule,
    restoreSchedule,
    permanentDeleteAllTrashed,
    updateFormConfig,
    checkScheduleOverlaps,
    type CreateScheduleInput,
    type UpdateScheduleInput,
} from './services/scheduleService';

import {
    addEvent,
    updateEvent,
    swapEvents,
    deleteEvent,
    getEventSummary,
    getScheduleEntries,
} from './services/entryService';

import { autoScheduleParticipants } from './services/autoScheduler';

import {
    getFormResponses,
    updateFormResponseAssigned,
    getPreferredTimings,
} from './api/form-responses';

// ============================================
// Execution
// ============================================

export async function executeFunction(
    functionName: string,
    args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return withDedup(functionName, args, async () => {
        try {
            switch (functionName) {

                // ============================================
                // Schedule Functions
                // ============================================

                case 'createSchedule': {
                    const input: CreateScheduleInput = {
                        label: args.label as string,
                        start_date: args.start_date as string,
                        end_date: args.end_date as string,
                    };
                    const schedule = await createSchedule(input);
                    return { success: true, data: schedule };
                }

                case 'listSchedules': {
                    const schedules = await getSchedules();
                    return { success: true, data: schedules };
                }

                case 'listTrashedSchedules': {
                    const schedules = await getTrashedSchedules();
                    return { success: true, data: schedules };
                }

                case 'updateSchedule': {
                    const { schedule_id, ...updates } = args;
                    const updated = await updateSchedule(
                        schedule_id as string,
                        updates as UpdateScheduleInput
                    );
                    return { success: true, data: updated };
                }

                case 'trashSchedule': {
                    await trashSchedule(args.schedule_id as string);
                    return { success: true, data: { message: 'Schedule moved to trash' } };
                }

                case 'recoverSchedule': {
                    await restoreSchedule(args.schedule_id as string);
                    return { success: true, data: { message: 'Schedule restored from trash' } };
                }

                case 'emptyTrash': {
                    const result = await permanentDeleteAllTrashed();
                    return {
                        success: true,
                        data: { message: `Permanently deleted ${result.count} schedule(s) from trash` },
                    };
                }

                case 'updateFormConfig': {
                    const { schedule_id, ...config } = args;
                    const result = await updateFormConfig(
                        schedule_id as string,
                        config as Parameters<typeof updateFormConfig>[1]
                    );
                    return { success: true, data: result };
                }

                case 'checkScheduleOverlaps': {
                    const result = await checkScheduleOverlaps(
                        args.start_date as string,
                        args.end_date as string,
                        args.exclude_id as string | undefined
                    );
                    return { success: true, data: result };
                }

                // ============================================
                // Event Functions
                // ============================================

                case 'addEventToSchedule': {
                    const event = await addEvent({
                        schedule_id: args.schedule_id as string,
                        student_name: args.student_name as string,
                        day: args.day as string,
                        hour: args.hour as number | undefined,
                        start_time: args.start_time as string | undefined,
                        end_time: args.end_time as string | undefined,
                        recurrence_rule: args.recurrence_rule as string | undefined,
                    });
                    return { success: true, data: event };
                }

                case 'updateEventInSchedule': {
                    const event = await updateEvent({
                        event_id: args.event_id as string,
                        student_name: args.student_name as string | undefined,
                        day: args.day as string | undefined,
                        hour: args.hour as number | undefined,
                        start_time: args.start_time as string | undefined,
                        end_time: args.end_time as string | undefined,
                        recurrence_rule: args.recurrence_rule as string | undefined,
                    });
                    return { success: true, data: event };
                }

                case 'swapEvents': {
                    if (!args.event1_id || !args.event2_id) {
                        throw new Error(
                            'Missing event IDs. Provide both event1_id and event2_id. ' +
                            'Call getEventSummaryInSchedule first to find them.'
                        );
                    }
                    const events = await swapEvents(
                        args.event1_id as string,
                        args.event2_id as string
                    );
                    return {
                        success: true,
                        data: { message: 'Events swapped successfully', events },
                    };
                }

                case 'deleteEventFromSchedule': {
                    await deleteEvent(args.event_id as string);
                    return { success: true, data: { message: 'Event deleted' } };
                }

                case 'getEventSummaryInSchedule': {
                    const summary = await getEventSummary(args.schedule_id as string);
                    return { success: true, data: summary };
                }

                // ============================================
                // Participant Functions
                // ============================================

                case 'listUnassignedParticipants': {
                    const responses = await getFormResponses(args.schedule_id as string);
                    const unassigned = responses.filter(r => !r.assigned);
                    return { success: true, data: unassigned };
                }

                case 'getParticipantPreferences': {
                    const responses = await getFormResponses(
                        args.schedule_id as string
                    );
                    const participant = responses.find(r => r.id === args.participant_id);
                    if (!participant) {
                        return { success: false, error: 'Participant not found' };
                    }
                    return {
                        success: true,
                        data: {
                            id: participant.id,
                            student_name: participant.student_name,
                            email: participant.email,
                            preferences: getPreferredTimings(participant),
                            assigned: participant.assigned,
                        },
                    };
                }

                case 'markParticipantAssigned': {
                    await updateFormResponseAssigned(
                        args.participant_id as string,
                        args.assigned as boolean
                    );
                    return {
                        success: true,
                        data: {
                            message: args.assigned
                                ? 'Participant marked as assigned'
                                : 'Participant marked as unassigned',
                        },
                    };
                }

                case 'autoScheduleParticipants': {
                    // Always preview mode from AI — UI handles commit via modal
                    const result = await autoScheduleParticipants(
                        args.schedule_id as string,
                        false
                    );
                    return { success: true, data: result };
                }

                // ============================================
                // Unknown
                // ============================================

                default:
                    return {
                        success: false,
                        error: `Unknown function: ${functionName}`,
                    };
            }
        } catch (err) {
            const ariaErr = toAriaError(err);
            console.error(`[functions] Error executing ${functionName}:`, ariaErr);
            return {
                success: false,
                error: ariaErr.message,
            };
        }
    });
}
