// src/lib/functions.ts
// LEGACY BRIDGE (BLD-001): temporary function gateway for schedule-centric tools.
// New v2.1 calendar commands should land in src/application/* and be wired here only
// as a compatibility adapter until legacy schedule tools are fully retired.

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
    createCalendarEventFromLegacyArgs,
    deleteCalendarEventById,
    getCalendarEventSummary,
    searchCalendarEvents,
    swapCalendarEventsById,
    updateCalendarEventFromLegacyArgs,
} from './api/calendar-chat';
import { fetchWorkspaceEvents } from './api/calendar-workspace';

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
// Input Validation
// ============================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireString(args: Record<string, unknown>, key: string, label?: string): string | null {
    const v = args[key];
    if (typeof v === 'string' && v.trim()) return null;
    return `Missing required field: ${label ?? key}`;
}

function requireUuid(args: Record<string, unknown>, key: string, label?: string): string | null {
    const v = args[key];
    if (typeof v === 'string' && UUID_RE.test(v.trim())) return null;
    if (typeof v === 'string' && v.trim()) return `${label ?? key} must be a valid UUID, got "${v}". Use a lookup tool first.`;
    return `Missing required field: ${label ?? key}`;
}

/**
 * Validate tool inputs before execution.
 * Returns an error string if validation fails, null if inputs are valid.
 */
function validateToolInput(name: string, args: Record<string, unknown>): string | null {
    switch (name) {
        case 'createSchedule':
            return requireString(args, 'label') ?? requireString(args, 'start_date') ?? requireString(args, 'end_date');
        case 'updateSchedule':
        case 'trashSchedule':
        case 'recoverSchedule':
        case 'publishSchedule':
        case 'getExportLink':
        case 'updateFormConfig':
        case 'analyzeScheduleHealth':
        case 'autoScheduleParticipants':
            return requireString(args, 'schedule_id');
        case 'addEventToSchedule':
            return requireString(args, 'student_name');
        case 'updateEventInSchedule':
            return requireString(args, 'event_id');
        case 'deleteEventFromSchedule':
            return requireString(args, 'event_id');
        case 'getEventSummaryInSchedule':
        case 'searchEventsInSchedule':
            return null;
        case 'listUnassignedParticipants':
            return requireString(args, 'schedule_id');
        case 'swapEvents': {
            const e1 = args.event1_id || args.event_id1 || args.id1;
            const e2 = args.event2_id || args.event_id2 || args.id2;
            if (!e1 || !e2) return 'Missing event IDs. Provide both event1_id and event2_id. Use getEventSummaryInSchedule first.';
            return null;
        }
        case 'markParticipantAssigned':
            return requireString(args, 'participant_id');
        case 'getParticipantPreferences':
            return requireString(args, 'participant_id');
        case 'proposeScheduleChanges':
            return requireString(args, 'schedule_id');
        case 'commitSchedulePlan':
            return requireUuid(args, 'plan_id');
        default:
            return null;
    }
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
        // Pre-flight validation
        const validationError = validateToolInput(resolvedFunctionName, args);
        if (validationError) {
            return { success: false, error: validationError };
        }

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
                    const summary = await getCalendarEventSummary();
                    return { success: true, data: { summary, message: 'Analyzing your schedule health...' } };
                }

                // ============================================
                // Event Functions
                // ============================================

                case 'addEventToSchedule': {
                    const event = await createCalendarEventFromLegacyArgs({
                        student_name: args.student_name as string,
                        day: args.day as string | undefined,
                        hour: normalizeHourForAddEvent(args.hour),
                        start_time: args.start_time as string | undefined,
                        end_time: args.end_time as string | undefined,
                    });
                    return { success: true, data: event };
                }

                case 'updateEventInSchedule': {
                    const event = await updateCalendarEventFromLegacyArgs({
                        event_id: args.event_id as string,
                        student_name: args.student_name as string | undefined,
                        day: args.day as string | undefined,
                        hour: normalizeHourForAddEvent(args.hour),
                        start_time: args.start_time as string | undefined,
                        end_time: args.end_time as string | undefined,
                    });
                    return { success: true, data: event };
                }

                case 'swapEvents': {
                    const e1 = (args.event1_id || args.event_id1 || args.id1) as string;
                    const e2 = (args.event2_id || args.event_id2 || args.id2) as string;
                    const events = await swapCalendarEventsById(e1, e2);
                    return { success: true, data: { message: 'Events swapped successfully', events } };
                }

                case 'deleteEventFromSchedule': {
                    await deleteCalendarEventById(args.event_id as string);
                    return { success: true, data: { message: 'Event deleted' } };
                }

                case 'getEventSummaryInSchedule': {
                    const summary = await getCalendarEventSummary();
                    return { success: true, data: summary };
                }

                case 'searchEventsInSchedule': {
                    const results = await searchCalendarEvents(args.query as string);
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

                    // Validate: Detect conflicts by checking current workspace events
                    const workspace = await fetchWorkspaceEvents();
                    const conflicts: PlanConflict[] = [];

                    for (const change of changes) {
                        if (change.action === 'add' && change.after?.start_time) {
                            // Check for time overlap with existing events
                            const targetDay = change.after.day;
                            const targetStart = change.after.start_time;
                            for (const event of workspace.events) {
                                const entryDate = new Date(event.startAt);
                                const entryDay = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
                                const entryHour = entryDate.getHours();
                                const targetHour = parseInt(targetStart?.split(':')[0] || '0');
                                if (entryDay === targetDay && entryHour === targetHour) {
                                    conflicts.push({
                                        type: 'overlap',
                                        description: `"${change.target}" conflicts with existing "${event.title || 'Untitled'}" at ${entryDay} ${entryHour}:00`,
                                        severity: 'error',
                                        affected_entries: [event.id, change.target],
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
                                        await createCalendarEventFromLegacyArgs({
                                            student_name: change.after.student_name || change.target,
                                            day: change.after.day || '',
                                            start_time: change.after.start_time ?? undefined,
                                            end_time: change.after.end_time ?? undefined,
                                        });
                                        results.push(`✅ Added: ${change.description}`);
                                    }
                                    break;
                                }
                                case 'delete': {
                                    await deleteCalendarEventById(change.target);
                                    results.push(`✅ Deleted: ${change.description}`);
                                    break;
                                }
                                case 'move': {
                                    if (change.after) {
                                        await updateCalendarEventFromLegacyArgs({
                                            event_id: change.target,
                                            student_name: change.after.student_name ?? undefined,
                                            day: change.after.day,
                                            start_time: change.after.start_time,
                                            end_time: change.after.end_time,
                                        });
                                        results.push(`✅ Moved: ${change.description}`);
                                    }
                                    break;
                                }
                                case 'swap': {
                                    const targets = change.target.split(',');
                                    if (targets.length !== 2) {
                                        throw new Error('swap action requires target in "eventIdA,eventIdB" format');
                                    }
                                    await swapCalendarEventsById(targets[0].trim(), targets[1].trim());
                                    results.push(`✅ Swapped: ${change.description}`);
                                    break;
                                }
                                case 'update': {
                                    if (change.after) {
                                        await updateCalendarEventFromLegacyArgs({
                                            event_id: change.target,
                                            student_name: change.after.student_name ?? undefined,
                                            day: change.after.day,
                                            start_time: change.after.start_time,
                                            end_time: change.after.end_time,
                                        });
                                        results.push(`✅ Updated: ${change.description}`);
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
