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
    type FrequencyType,
} from './services/entryService';

import { autoScheduleParticipants } from './services/autoScheduler';

import {
    getFormResponses,
    getFormResponseById,
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

const FUNCTION_NAME_ALIASES: Record<string, string> = {
    // Event aliases
    updateevent: 'updateEventInSchedule',
    moveevent: 'updateEventInSchedule',
    editevent: 'updateEventInSchedule',
    modifyevent: 'updateEventInSchedule',
    addevent: 'addEventToSchedule',
    createevent: 'addEventToSchedule',
    deleteevent: 'deleteEventFromSchedule',
    removeevent: 'deleteEventFromSchedule',
    listevents: 'getEventSummaryInSchedule',
    geteventsummary: 'getEventSummaryInSchedule',
    // Plan aliases
    proposeplan: 'proposeScheduleChanges',
    createscheduleplan: 'proposeScheduleChanges',
    commitplan: 'commitSchedulePlan',
    applyplan: 'commitSchedulePlan',
    // Participant aliases
    listunassigned: 'listUnassignedParticipants',
    scheduleallparticipants: 'autoScheduleParticipants',
};

function normalizeFunctionName(functionName: string): string {
    const canonical = functionName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return FUNCTION_NAME_ALIASES[canonical] ?? functionName;
}

function normalizeRecurrenceForAddEvent(
    rawRule: unknown
): { recurrence_rule?: string; frequency?: FrequencyType } {
    if (rawRule === undefined || rawRule === null) return {};
    if (typeof rawRule !== 'string') return { recurrence_rule: '' };

    const rule = rawRule.trim();
    if (!rule) return { recurrence_rule: '' };

    const normalized = rule.toLowerCase();
    if (normalized === 'none' || normalized === 'once' || normalized === 'one-time' || normalized === 'onetime') {
        return { recurrence_rule: '' };
    }
    if (normalized === 'daily') return { recurrence_rule: '', frequency: 'daily' };
    if (normalized === 'weekly') return { recurrence_rule: '', frequency: 'weekly' };
    if (normalized === 'biweekly' || normalized === 'bi-weekly') return { recurrence_rule: '', frequency: '2weekly' };
    if (normalized === 'monthly') return { recurrence_rule: '', frequency: 'monthly' };

    if (rule.toUpperCase().startsWith('FREQ=')) {
        return { recurrence_rule: rule };
    }

    // Unknown recurrence hint from model — fall back to one-time instead of storing invalid rules.
    return { recurrence_rule: '' };
}

function normalizeHourForAddEvent(rawHour: unknown): number | undefined {
    if (rawHour === undefined || rawHour === null) return undefined;
    if (typeof rawHour === 'number' && Number.isFinite(rawHour)) return Math.trunc(rawHour);
    if (typeof rawHour !== 'string') return undefined;

    const value = rawHour.trim().toLowerCase();
    if (!value) return undefined;

    // Matches: "15", "15:00", "11am", "11:00 am"
    const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!match) return undefined;

    let hour = parseInt(match[1], 10);
    const meridiem = match[3];
    if (meridiem === 'am') {
        if (hour === 12) hour = 0;
    } else if (meridiem === 'pm') {
        if (hour < 12) hour += 12;
    }
    if (hour < 0 || hour > 23) return undefined;
    return hour;
}

function toStringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizePlanChanges(raw: unknown): PlanChange[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const validActions = new Set<PlanChange['action']>(['add', 'move', 'swap', 'delete', 'update']);
    const normalized: PlanChange[] = [];

    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;

        const actionRaw = toStringOrUndefined(row.action) ?? toStringOrUndefined(row.type);
        const canonicalAction = actionRaw?.toLowerCase() === 'remove'
            ? 'delete'
            : actionRaw?.toLowerCase();
        if (!canonicalAction || !validActions.has(canonicalAction as PlanChange['action'])) continue;

        const target = toStringOrUndefined(row.target)
            ?? toStringOrUndefined(row.event_id)
            ?? toStringOrUndefined(row.student_name)
            ?? 'unknown';
        const description = toStringOrUndefined(row.description) ?? `${canonicalAction} ${target}`;

        const beforeRaw = row.before && typeof row.before === 'object'
            ? row.before as Record<string, unknown>
            : undefined;
        const afterRaw = row.after && typeof row.after === 'object'
            ? row.after as Record<string, unknown>
            : undefined;

        const before = beforeRaw ? {
            day: toStringOrUndefined(beforeRaw.day),
            start_time: toStringOrUndefined(beforeRaw.start_time),
            end_time: toStringOrUndefined(beforeRaw.end_time),
            recurrence_rule: toStringOrUndefined(beforeRaw.recurrence_rule),
        } : undefined;

        const after = afterRaw ? {
            day: toStringOrUndefined(afterRaw.day),
            start_time: toStringOrUndefined(afterRaw.start_time),
            end_time: toStringOrUndefined(afterRaw.end_time),
            recurrence_rule: toStringOrUndefined(afterRaw.recurrence_rule),
            student_name: toStringOrUndefined(afterRaw.student_name),
            schedule_id: toStringOrUndefined(afterRaw.schedule_id),
        } : undefined;

        normalized.push({
            action: canonicalAction as PlanChange['action'],
            target,
            description,
            before,
            after,
        });
    }

    return normalized.length > 0 ? normalized : null;
}

// ============================================
// Execution
// ============================================

export async function executeFunction(
    functionName: string,
    args: Record<string, unknown>,
    options?: { bypassDedup?: boolean }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const resolvedFunctionName = normalizeFunctionName(functionName);

    const run = async () => {
        try {
            switch (resolvedFunctionName) {

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
                    const normalizedRecurrence = normalizeRecurrenceForAddEvent(args.recurrence_rule);
                    const event = await addEvent({
                        schedule_id: args.schedule_id as string,
                        student_name: args.student_name as string,
                        day: args.day as string,
                        hour: normalizeHourForAddEvent(args.hour),
                        start_time: args.start_time as string | undefined,
                        end_time: args.end_time as string | undefined,
                        recurrence_rule: normalizedRecurrence.recurrence_rule,
                        frequency: normalizedRecurrence.frequency,
                    });
                    return { success: true, data: event };
                }

                case 'updateEventInSchedule': {
                    const event = await updateEvent({
                        event_id: args.event_id as string,
                        student_name: args.student_name as string | undefined,
                        day: args.day as string | undefined,
                        hour: normalizeHourForAddEvent(args.hour),
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
                    const participantId = args.participant_id as string | undefined;
                    if (!participantId) {
                        return { success: false, error: 'Missing participant_id' };
                    }

                    let participant = null as Awaited<ReturnType<typeof getFormResponseById>>;
                    const scheduleId = args.schedule_id as string | undefined;

                    if (scheduleId) {
                        const responses = await getFormResponses(scheduleId);
                        participant = responses.find(r => r.id === participantId) ?? null;
                    } else {
                        participant = await getFormResponseById(participantId);
                    }

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
                    const changes = normalizePlanChanges(args.changes);
                    if (!scheduleId || typeof scheduleId !== 'string') {
                        return { success: false, error: 'Missing schedule_id for proposeScheduleChanges.' };
                    }
                    if (!changes) {
                        return {
                            success: false,
                            error: 'Invalid changes format. Use changes[] with action(add|move|swap|delete|update), target, and description.',
                        };
                    }

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
            console.error(`[functions] Error executing ${resolvedFunctionName} (requested: ${functionName}):`, ariaErr);
            return {
                success: false,
                error: ariaErr.message,
            };
        }
    };

    if (options?.bypassDedup) {
        return run();
    }

    return withDedup(resolvedFunctionName, args, run);
}
