// src/lib/services/autoScheduler.ts
// Orchestrates automatic scheduling of all unassigned participants.
// Calls the pure scheduling algorithm then persists results to the database.
// Never imported by api/*. Only called from functions.ts.

import { supabase } from '../supabase';
import {
    getScheduleEntries as apiGetScheduleEntries,
    createScheduleEntry as apiCreateScheduleEntry,
    type ScheduleEntry,
} from '../api/schedule-entries';
import {
    getFormResponses as apiGetFormResponses,
    updateFormResponseAssigned as apiUpdateFormResponseAssigned,
    type FormResponse,
} from '../api/form-responses';
import {
    scheduleParticipants,
    createEntryFromAssignment,
    dayToIndex,
} from '../scheduling';
import {
    buildRecurrenceRule,
    type FrequencyType,
} from '../recurrence';
import { AuthError, NotFoundError, ValidationError } from '../errors';
import { withRetry } from '../retry';

// ============================================
// Types
// ============================================

export interface ProposedEntry {
    schedule_id: string;
    student_name: string;
    start_time: string;
    end_time: string;
    recurrence_rule: string;
    participant_id: string; // The form_response id this entry is for
}

export interface AutoScheduleResult {
    message: string;
    scheduledCount: number;
    unscheduledCount: number;
    proposedEntries: ProposedEntry[];
    committedEntries?: ScheduleEntry[];
    previewMode: boolean;
}

// ============================================
// Auto Scheduler
// ============================================

// Runs the scheduling algorithm against all unassigned participants.
// If commit=false, returns proposed entries for UI preview without saving.
// If commit=true, persists all entries and marks participants as assigned.
export async function autoScheduleParticipants(
    scheduleId: string,
    commit: boolean = false
): Promise<AutoScheduleResult> {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError();

    // Load schedule config
    const { data: schedule, error: schedErr } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .eq('user_id', user.id)
        .single();

    if (schedErr || !schedule) throw new NotFoundError('Schedule');

    // Load unassigned participants
    const allResponses = await withRetry(() => apiGetFormResponses(scheduleId));
    const unassigned = allResponses.filter((r: FormResponse) => !r.assigned);

    if (unassigned.length === 0) {
        return {
            message: 'No unassigned participants found.',
            scheduledCount: 0,
            unscheduledCount: 0,
            proposedEntries: [],
            previewMode: !commit,
        };
    }

    // Load existing entries for conflict detection
    const existingEntries = await withRetry(() => apiGetScheduleEntries(scheduleId));

    // Calculate schedule duration in weeks
    const startDate = new Date(schedule.start_date);
    const endDate = new Date(schedule.end_date);
    const totalWeeks = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    );

    if (totalWeeks <= 0) {
        throw new ValidationError('Schedule date range is too short to auto-schedule.');
    }

    // Run pure scheduling algorithm
    const result = scheduleParticipants(
        unassigned,
        existingEntries,
        startDate,
        totalWeeks,
        schedule.working_hours_start,
        schedule.working_hours_end
    );

    // Build proposed entries from algorithm output
    const proposedEntries: ProposedEntry[] = [];
    const assignedParticipantIds: string[] = [];

    const DAY_ABBREVS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    for (const assignment of result.assignments) {
        if (!assignment.isScheduled) continue;

        // createEntryFromAssignment gives us start/end times for week 0
        const entryData = createEntryFromAssignment(assignment, startDate, 0);
        const entryDate = new Date(entryData.start_time);

        // Build recurrence rule from assignment frequency
        const frequency = assignment.timing.frequency as FrequencyType;
        const recurrenceRule = buildRecurrenceRule(frequency, entryDate);

        proposedEntries.push({
            schedule_id: scheduleId,
            student_name: assignment.participant.student_name,
            start_time: entryData.start_time,
            end_time: entryData.end_time,
            recurrence_rule: recurrenceRule,
            participant_id: assignment.participant.id,
        });

        assignedParticipantIds.push(assignment.participant.id);
    }

    if (!commit) {
        return {
            message: `Preview generated for ${proposedEntries.length} participant(s).`,
            scheduledCount: result.totalScheduled,
            unscheduledCount: result.totalUnassigned,
            proposedEntries,
            previewMode: true,
        };
    }

    // Commit: insert all entries and mark participants as assigned
    const committedEntries: ScheduleEntry[] = [];

    if (proposedEntries.length > 0) {
        // Batch insert all entries
        const { data: inserted, error: insertErr } = await supabase
            .from('schedule_entries')
            .insert(
                proposedEntries.map(({ participant_id, ...entry }) => entry)
            )
            .select();

        if (insertErr) {
            throw new Error(`Failed to create entries: ${insertErr.message}`);
        }

        committedEntries.push(...(inserted ?? []));

        // Mark all participants as assigned
        await Promise.all(
            assignedParticipantIds.map(id =>
                withRetry(() => apiUpdateFormResponseAssigned(id, true))
            )
        );
    }

    return {
        message: `Successfully scheduled ${result.totalScheduled} participant(s).`,
        scheduledCount: result.totalScheduled,
        unscheduledCount: result.totalUnassigned,
        proposedEntries,
        committedEntries,
        previewMode: false,
    };
}
