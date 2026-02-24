// src/lib/functions.ts
// AI function execution layer.
// Primarily calls services; a few direct api/* imports remain for plan/form primitives.
// Wraps all executions with deduplication to prevent AI double-fire.

import { withDedup } from './retry';
import { toAriaError } from './errors';

import {
    createSchedule,
    getSchedulesSummary,
    getTrashedSchedules,
    updateSchedule,
    trashSchedule,
    restoreSchedule,
    permanentDeleteAllTrashed,
    updateFormConfig,
    checkScheduleOverlaps,
    publishSchedule,
    generateExportLink,
    type CreateScheduleInput,
    type UpdateScheduleInput,
} from './services/scheduleService';

import {
    addEvent,
    updateEvent,
    swapEvents,
    deleteEvent,
    getEventSummary,
    searchEventsInSchedule,
} from './services/entryService';

import { autoScheduleParticipants } from './services/autoScheduler';

import {
    getFormResponses,
    updateFormResponseAssigned,
    getPreferredTimings,
} from './api/form-responses';

import {
    createPlan,
    getPlan,
    commitPlan,
    type PlanChange,
    type PlanConflict,
} from './api/schedule-plans';

import {
    getScheduleEntries,
} from './api/schedule-entries';

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
                    const schedules = await getSchedulesSummary();
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

                case 'publishSchedule': {
                    await publishSchedule(args.schedule_id as string);
                    return { success: true, data: { message: 'Schedule published successfully! Participants will be notified.' } };
                }

                case 'getExportLink': {
                    const link = generateExportLink(args.schedule_id as string);
                    return { success: true, data: { message: 'Here is the link for your schedule:', link } };
                }

                case 'analyzeScheduleHealth': {
                    const summary = await getEventSummary(args.schedule_id as string);
                    return { success: true, data: { summary, message: 'Analyzing your schedule health...' } };
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
                    // Normalize hallucinations: event1_id vs event_id1 vs id1
                    const e1 = (args.event1_id || args.event_id1 || args.id1) as string;
                    const e2 = (args.event2_id || args.event_id2 || args.id2) as string;

                    if (!e1 || !e2) {
                        throw new Error(
                            'Missing event IDs. Provide both event1_id and event2_id. ' +
                            'Call getEventSummaryInSchedule first to find them.'
                        );
                    }
                    const events = await swapEvents(e1, e2);
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

                case 'searchEventsInSchedule': {
                    const results = await searchEventsInSchedule(
                        args.schedule_id as string,
                        args.query as string
                    );
                    return { success: true, data: results };
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
                // Agentic Plan Tools
                // ============================================

                case 'proposeScheduleChanges': {
                    const scheduleId = args.schedule_id as string;
                    const changes = args.changes as PlanChange[];

                    // Validate: Detect conflicts by checking existing entries
                    const existingEntries = await getScheduleEntries(scheduleId);
                    const conflicts: PlanConflict[] = [];

                    for (const change of changes) {
                        if (change.action === 'add' && change.after?.start_time) {
                            // Check for time overlap with existing entries
                            const targetDay = change.after.day;
                            const targetStart = change.after.start_time;
                            for (const entry of existingEntries) {
                                const entryDate = new Date(entry.start_time);
                                const entryDay = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
                                const entryHour = entryDate.getHours();
                                const targetHour = parseInt(targetStart?.split(':')[0] || '0');
                                if (entryDay === targetDay && entryHour === targetHour) {
                                    conflicts.push({
                                        type: 'overlap',
                                        description: `"${change.target}" conflicts with existing "${entry.student_name}" at ${entryDay} ${entryHour}:00`,
                                        severity: 'error',
                                        affected_entries: [entry.id, change.target],
                                    });
                                }
                            }
                        }
                    }

                    const summary = changes.map(c =>
                        `${c.action.toUpperCase()}: ${c.description}`
                    ).join('\n');

                    const plan = await createPlan(scheduleId, changes, conflicts, summary);

                    return {
                        success: true,
                        data: {
                            plan_id: plan.id,
                            status: plan.status,
                            changes: plan.changes,
                            conflicts: plan.conflicts,
                            summary: plan.summary,
                            expires_at: plan.expires_at,
                            message: conflicts.length > 0
                                ? `I found ${conflicts.length} conflict(s). Review the plan below and let me know if you'd like to proceed or adjust.`
                                : `Here's the proposed plan. Say "yes" or "go ahead" to apply these changes.`,
                        },
                    };
                }

                case 'commitSchedulePlan': {
                    const planId = args.plan_id as string;
                    const plan = await getPlan(planId);

                    if (!plan) {
                        return { success: false, error: 'Plan not found. It may have expired.' };
                    }
                    if (plan.status !== 'pending') {
                        return { success: false, error: `Plan is already ${plan.status}.` };
                    }
                    if (new Date(plan.expires_at) < new Date()) {
                        return { success: false, error: 'This plan has expired. Please propose a new one.' };
                    }

                    // Execute each change in the plan
                    const results: string[] = [];
                    for (const change of plan.changes as PlanChange[]) {
                        try {
                            switch (change.action) {
                                case 'add': {
                                    if (change.after) {
                                        await addEvent({
                                            schedule_id: plan.schedule_id,
                                            student_name: change.after.student_name || change.target,
                                            day: change.after.day || '',
                                            start_time: change.after.start_time,
                                            end_time: change.after.end_time,
                                            recurrence_rule: change.after.recurrence_rule,
                                        });
                                        results.push(`✅ Added: ${change.description}`);
                                    }
                                    break;
                                }
                                case 'delete': {
                                    await deleteEvent(change.target);
                                    results.push(`✅ Deleted: ${change.description}`);
                                    break;
                                }
                                case 'move': {
                                    if (change.after) {
                                        await updateEvent({
                                            event_id: change.target,
                                            day: change.after.day,
                                            start_time: change.after.start_time,
                                            end_time: change.after.end_time,
                                        });
                                        results.push(`✅ Moved: ${change.description}`);
                                    }
                                    break;
                                }
                                case 'swap': {
                                    // Swap requires two entry IDs
                                    const targets = change.target.split(',');
                                    if (targets.length === 2) {
                                        await swapEvents(targets[0].trim(), targets[1].trim());
                                        results.push(`✅ Swapped: ${change.description}`);
                                    }
                                    break;
                                }
                                default:
                                    results.push(`⚠️ Skipped unknown action: ${change.action}`);
                            }
                        } catch (err: any) {
                            results.push(`❌ Failed: ${change.description} — ${err.message}`);
                        }
                    }

                    // Mark plan as committed
                    await commitPlan(planId);

                    return {
                        success: true,
                        data: {
                            message: `Plan committed! Here's the result:\n${results.join('\n')}`,
                            results,
                        },
                    };
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
