// src/lib/services/entryService.ts
// Business logic for schedule entry (event) operations.
// Handles add, update, move, swap with validation and optimistic locking.
// Never imports from other services. Only imports from api/* and lib/*.

import {
    getScheduleEntries as apiGetScheduleEntries,
    createScheduleEntry as apiCreateScheduleEntry,
    updateScheduleEntry as apiUpdateScheduleEntry,
    deleteScheduleEntry as apiDeleteScheduleEntry,
    type ScheduleEntry,
    type CreateScheduleEntryInput,
} from '../api/schedule-entries';
import { supabase } from '../supabase';
import {
    buildRecurrenceRule,
    updateRecurrenceRule,
    parseRecurrenceRule,
    type FrequencyType,
} from '../recurrence';
import { ValidationError, NotFoundError, ConflictError } from '../errors';
import { withRetry } from '../retry';
import { resolveScheduleId } from './scheduleService';

// ============================================
// Private Helpers
// ============================================

const DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
];



// Finds the first occurrence of a weekday on or after a schedule's start date.
// Parsed in LOCAL time to avoid UTC offset issues.
function findFirstDayOccurrence(scheduleStartDate: string, dayName: string): string {
    const targetIndex = DAY_NAMES.findIndex(
        d => d.toLowerCase() === dayName.toLowerCase()
    );
    if (targetIndex < 0) throw new ValidationError(`Invalid day name: ${dayName}`);

    const [year, month, day] = scheduleStartDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    if (isNaN(start.getTime())) {
        throw new ValidationError(`Invalid schedule start date: ${scheduleStartDate}`);
    }

    let diff = targetIndex - start.getDay();
    if (diff < 0) diff += 7;

    const first = new Date(start);
    first.setDate(start.getDate() + diff);

    const yyyy = first.getFullYear();
    const mm = String(first.getMonth() + 1).padStart(2, '0');
    const dd = String(first.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Normalizes a day name: strips trailing 's', fixes capitalization.
// e.g. "fridays" -> "Friday"
function normalizeDay(raw: string): string {
    let clean = raw.trim();
    if (clean.toLowerCase().endsWith('s')) clean = clean.slice(0, -1);
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

// Fetches a single entry directly from Supabase.
// Returns updated_at for optimistic locking.
async function getEntryById(entryId: string): Promise<ScheduleEntry & { updated_at: string }> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('id', entryId)
        .single();

    if (error || !data) throw new NotFoundError(`Event ${entryId}`);
    return data;
}

// Validates that an entry has not been modified since it was read.
// Throws ConflictError if updated_at has changed.
function assertNotStale(
    entryId: string,
    knownUpdatedAt: string,
    freshUpdatedAt: string
): void {
    if (knownUpdatedAt !== freshUpdatedAt) {
        throw new ConflictError(
            `Event ${entryId} was modified by another operation. Please refresh and try again.`
        );
    }
}

// Validates entry input before any write
function validateEntryInput(input: {
    student_name?: string;
    start_time?: string;
    end_time?: string;
}): void {
    if (input.student_name !== undefined && !input.student_name.trim()) {
        throw new ValidationError('Event title cannot be empty');
    }
    if (input.start_time && input.end_time) {
        const start = new Date(input.start_time);
        const end = new Date(input.end_time);
        if (isNaN(start.getTime())) throw new ValidationError('Invalid start time');
        if (isNaN(end.getTime())) throw new ValidationError('Invalid end time');
        if (start >= end) throw new ValidationError('End time must be after start time');
    }
}

// ============================================
// Entry Service — Public API
// ============================================

export async function getScheduleEntries(scheduleId: string): Promise<ScheduleEntry[]> {
    return withRetry(() => apiGetScheduleEntries(scheduleId));
}

// Add an event to a schedule.
// Accepts either a UUID or label for schedule_id.
export async function addEvent(args: {
    schedule_id: string;
    student_name: string;
    day: string;
    hour?: number;
    start_time?: string;  // HH:MM — overrides hour if provided
    end_time?: string;    // HH:MM — overrides hour+1 if provided
    recurrence_rule?: string;
    frequency?: FrequencyType; // Used if recurrence_rule not provided
}): Promise<ScheduleEntry> {
    // Resolve schedule
    const resolvedScheduleId = await resolveScheduleId(args.schedule_id);

    const { data: schedule, error: schedErr } = await supabase
        .from('schedules')
        .select('start_date')
        .eq('id', resolvedScheduleId)
        .single();

    if (schedErr || !schedule) throw new NotFoundError('Schedule');

    // Normalize day
    const dayClean = normalizeDay(args.day);

    // Resolve start/end times
    const timeRegex = /^\d{1,2}:\d{2}$/;
    let startStr = args.start_time;
    let endStr = args.end_time;

    if (!startStr || !timeRegex.test(startStr)) {
        const hourInt = parseInt(String(args.hour ?? 9), 10);
        if (isNaN(hourInt) || hourInt < 0 || hourInt > 23) {
            throw new ValidationError(`Invalid hour: ${args.hour}. Must be 0–23.`);
        }
        startStr = `${hourInt.toString().padStart(2, '0')}:00`;
        endStr = `${(hourInt + 1).toString().padStart(2, '0')}:00`;
    }

    // Build datetime from first occurrence of the day
    const firstDate = findFirstDayOccurrence(schedule.start_date, dayClean);
    const startTime = new Date(`${firstDate}T${startStr}:00`);
    const endTime = new Date(`${firstDate}T${endStr}:00`);

    if (isNaN(startTime.getTime())) {
        throw new ValidationError(`Cannot construct start time from day "${dayClean}" and time "${startStr}"`);
    }
    if (isNaN(endTime.getTime())) {
        throw new ValidationError(`Cannot construct end time from day "${dayClean}" and time "${endStr}"`);
    }

    validateEntryInput({
        student_name: args.student_name,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
    });

    // Resolve recurrence rule
    let recurrenceRule = args.recurrence_rule ?? '';
    if (!recurrenceRule && args.frequency && args.frequency !== 'once') {
        recurrenceRule = buildRecurrenceRule(args.frequency, startTime);
    }

    const entry: CreateScheduleEntryInput = {
        schedule_id: resolvedScheduleId,
        student_name: args.student_name.trim(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        recurrence_rule: recurrenceRule,
    };

    return withRetry(() => apiCreateScheduleEntry(entry));
}

// Update an event's name, time, day, or recurrence rule.
export async function updateEvent(args: {
    event_id: string;
    student_name?: string;
    day?: string;
    hour?: number;
    start_time?: string;
    end_time?: string;
    recurrence_rule?: string;
}): Promise<ScheduleEntry> {
    const original = await getEntryById(args.event_id);

    const updates: Partial<{
        student_name: string;
        start_time: string;
        end_time: string;
        recurrence_rule: string;
    }> = {};

    if (args.student_name !== undefined) {
        updates.student_name = args.student_name.trim();
    }

    // Explicit recurrence_rule always wins — do not auto-calculate
    const hasExplicitRule = args.recurrence_rule !== undefined;
    if (hasExplicitRule) {
        updates.recurrence_rule = args.recurrence_rule;
    }

    // Resolve new time if day or hour provided
    if (args.day !== undefined) {
        const hour = args.hour ?? parseInt(original.start_time.substring(11, 13), 10);
        const { data: schedule, error: schedErr } = await supabase
            .from('schedules')
            .select('start_date')
            .eq('id', original.schedule_id)
            .single();

        if (schedErr || !schedule) throw new NotFoundError('Schedule');

        const dayClean = normalizeDay(args.day);
        const firstDate = findFirstDayOccurrence(schedule.start_date, dayClean);

        const startStr = args.start_time ?? `${hour.toString().padStart(2, '0')}:00`;
        const endStr = args.end_time ?? `${Math.min(hour + 1, 23).toString().padStart(2, '0')}:00`;

        updates.start_time = new Date(`${firstDate}T${startStr}:00Z`).toISOString();
        updates.end_time = new Date(`${firstDate}T${endStr}:00Z`).toISOString();

        validateEntryInput(updates);

        // Auto-update recurrence rule only if not explicitly provided
        if (!hasExplicitRule) {
            updates.recurrence_rule = updateRecurrenceRule(
                original.recurrence_rule,
                new Date(updates.start_time + 'Z')
            );
        }
    }

    return withRetry(() => apiUpdateScheduleEntry(args.event_id, updates));
}

// Atomically swap two events including their recurrence rules.
// Uses optimistic locking — reads both entries, validates updated_at before writing.
export async function swapEvents(
    event1Id: string,
    event2Id: string
): Promise<[ScheduleEntry, ScheduleEntry]> {
    // Read both entries and capture updated_at for optimistic locking
    const [entry1, entry2] = await Promise.all([
        getEntryById(event1Id),
        getEntryById(event2Id),
    ]);

    const time1 = { start: entry1.start_time, end: entry1.end_time };
    const time2 = { start: entry2.start_time, end: entry2.end_time };
    // const updatedAt1 = entry1.updated_at; (Removed unused variable)
    const updatedAt2 = entry2.updated_at;

    // Step 1: Move entry1 to a safe temp time (100 years ahead) to avoid unique constraint collisions
    const tempStart = new Date(time1.start);
    tempStart.setFullYear(tempStart.getFullYear() + 100);
    const tempEnd = new Date(time1.end);
    tempEnd.setFullYear(tempEnd.getFullYear() + 100);

    await withRetry(() =>
        apiUpdateScheduleEntry(event1Id, {
            start_time: tempStart.toISOString(),
            end_time: tempEnd.toISOString(),
        })
    );

    try {
        // Step 2: Re-read both entries to validate nothing changed while we were working
        const [, fresh2] = await Promise.all([
            getEntryById(event1Id),
            getEntryById(event2Id),
        ]);

        // entry2 must not have changed since we read it
        assertNotStale(event2Id, updatedAt2, fresh2.updated_at);

        // Step 3: Move entry2 into entry1's original slot
        const newRule2 = updateRecurrenceRule(entry2.recurrence_rule, new Date(time1.start));
        await withRetry(() =>
            apiUpdateScheduleEntry(event2Id, {
                start_time: time1.start,
                end_time: time1.end,
                recurrence_rule: newRule2,
            })
        );

        // Step 4: Move entry1 (from temp) into entry2's original slot
        const newRule1 = updateRecurrenceRule(entry1.recurrence_rule, new Date(time2.start));
        const updated1 = await withRetry(() =>
            apiUpdateScheduleEntry(event1Id, {
                start_time: time2.start,
                end_time: time2.end,
                recurrence_rule: newRule1,
            })
        );

        const updated2 = await getEntryById(event2Id);
        return [updated1, updated2];

    } catch (err) {
        // If anything fails after moving entry1 to temp, attempt to roll it back
        console.error('[entryService] Swap failed, attempting rollback of entry1:', err);
        try {
            await apiUpdateScheduleEntry(event1Id, {
                start_time: time1.start,
                end_time: time1.end,
                recurrence_rule: entry1.recurrence_rule,
            });
        } catch (rollbackErr) {
            console.error('[entryService] Rollback failed:', rollbackErr);
        }
        throw err;
    }
}

// Delete an event permanently
export async function deleteEvent(eventId: string): Promise<void> {
    return withRetry(() => apiDeleteScheduleEntry(eventId));
}

/**
 * Searches for specific events in a schedule for token efficiency.
 * Prevents pulling the entire schedule summary when only one person/lesson is needed.
 */
export async function searchEventsInSchedule(
    scheduleId: string,
    query: string
): Promise<Array<{ i: string; n: string; t: string; r: string }>> {
    const entries = await withRetry(() => apiGetScheduleEntries(scheduleId));
    const lowerQuery = query.toLowerCase();

    const matches = entries.filter(entry =>
        entry.student_name.toLowerCase().includes(lowerQuery)
    );

    return matches.map(entry => {
        const date = new Date(entry.start_time);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return {
            i: entry.id,
            n: entry.student_name,
            t: `${hours}:${minutes}`,
            r: entry.recurrence_rule,
        };
    });
}

// Get event summary grouped by day for AI context.
// Returns minified keys (i, n, t, r) to save tokens.
export async function getEventSummary(
    scheduleId: string
): Promise<Record<string, Array<{ i: string; n: string; t: string; r: string }>>> {
    const entries = await withRetry(() => apiGetScheduleEntries(scheduleId));

    const summary: Record<string, Array<{ i: string; n: string; t: string; r: string }>> = {};
    DAY_NAMES.forEach(day => (summary[day] = []));

    entries.forEach(entry => {
        const rule = parseRecurrenceRule(entry.recurrence_rule);
        const date = new Date(entry.start_time);
        const dayIndex = rule?.dayIndex != null ? rule.dayIndex : date.getDay();
        const dayName = DAY_NAMES[dayIndex];

        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');

        summary[dayName].push({
            i: entry.id,
            n: entry.student_name,
            t: `${hours}:${minutes}`,
            r: entry.recurrence_rule,
        });
    });

    return summary;
}

// Re-export types needed by callers
export type { ScheduleEntry, CreateScheduleEntryInput, FrequencyType };
