import { supabase } from "../supabase";
import {
    getScheduleEntries,
    createScheduleEntry,
    updateScheduleEntry,
    deleteScheduleEntry
} from './schedule-entries';
import {
    getFormResponses,
    updateFormResponseAssigned,
    getPreferredTimings
} from './form-responses';

export interface Schedule {
    id: string;
    user_id: string;
    label: string;
    start_date: string; // YYYY-MM-DD Format
    end_date: string; // YYYY-MM-DD Format
    status: 'draft' | 'collecting' | 'archived' | 'trashed';
    deleted_at: string | null;
    previous_status: 'draft' | 'collecting' | 'archived' | null; // Store status before trashing
    send_confirmation_email: boolean; // Whether to send confirmation emails
    created_at: string;
    // Form configuration
    max_choices: number;
    form_instructions: string | null;
    form_deadline: string | null;
}

export interface Schedule {
    id: string;
    user_id: string;
    label: string;
    start_date: string; // YYYY-MM-DD Format
    end_date: string; // YYYY-MM-DD Format
    status: 'draft' | 'collecting' | 'archived' | 'trashed';
    deleted_at: string | null;
    previous_status: 'draft' | 'collecting' | 'archived' | null; // Store status before trashing
    send_confirmation_email: boolean; // Whether to send confirmation emails
    created_at: string;
    // Form configuration
    max_choices: number;
    form_instructions: string | null;
    form_deadline: string | null;
}

export interface FormConfigInput {
    max_choices?: number;
    form_instructions?: string | null;
    form_deadline?: string | null;
}

export interface CreateScheduleInput {
    label: string;
    start_date: string; // YYYY-MM-DD Format
    end_date: string; // YYYY-MM-DD Format
}

export interface UpdateScheduleInput {
    label?: string;
    start_date?: string; // YYYY-MM-DD Format
    end_date?: string;   // YYYY-MM-DD Format
    status?: 'draft' | 'collecting' | 'archived' | 'trashed';
    send_confirmation_email?: boolean;
    previous_status?: 'draft' | 'collecting' | 'archived' | null;
}

// (Removed duplicate findFirstDayOccurrence to keep a single implementation elsewhere)

// Resolve a schedule UUID by its label (case-insensitive). Returns null if not found or ambiguous.
export async function resolveScheduleIdByLabel(label: string): Promise<string | null> {
    const schedules = await getSchedules();
    const matches = schedules.filter(s => s.label.toLowerCase() === label.toLowerCase());
    if (matches.length === 1) return matches[0].id;
    return null;
}

// Helper: find first occurrence of a day within a schedule's start date
// IMPORTANT: Parse date in LOCAL time to avoid timezone offset issues
function findFirstDayOccurrence(scheduleStartDate: string, dayName: string): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetIndex = days.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
    if (targetIndex < 0) throw new Error(`Invalid day name: ${dayName}`);

    // Parse YYYY-MM-DD in LOCAL time (not UTC) to avoid day offset
    const [year, month, day] = scheduleStartDate.split('-').map(Number);
    const start = new Date(year, month - 1, day); // month is 0-indexed
    if (isNaN(start.getTime())) throw new Error(`Invalid start date: ${scheduleStartDate}`);

    const currentIndex = start.getDay();
    let diff = targetIndex - currentIndex;
    if (diff < 0) diff += 7;
    const first = new Date(start);
    first.setDate(start.getDate() + diff);

    // Return YYYY-MM-DD in local time
    const yyyy = first.getFullYear();
    const mm = String(first.getMonth() + 1).padStart(2, '0');
    const dd = String(first.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export interface ScheduleValidationError extends Error {
    code: 'SCHEDULE_LIMIT_EXCEEDED' | 'INVALID_DATE_RANGE' | 'INVALID_STATUS_TRANSITION' | 'SCHEDULE_NOT_FOUND' | 'UNAUTHORIZED';
}

// Create new schedule
export async function createSchedule(scheduleData: CreateScheduleInput) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED'
        throw error;
    }

    // Validate date range
    const startDate = new Date(scheduleData.start_date);
    const endDate = new Date(scheduleData.end_date);

    if (startDate >= endDate) {
        const error = new Error('End date must be after start date') as ScheduleValidationError;
        error.code = 'INVALID_DATE_RANGE';
        throw error;
    }

    // Check schedule limit (max 3)
    const { data: existingSchedules, error: countError } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'trashed');

    if (countError) {
        throw new Error(`Failed to check schedule limit: ${countError.message}`);
    }

    if (existingSchedules && existingSchedules.length >= 3) {
        const error = new Error('Maximum of 3 schedules allowed. Please archive or delete existing schedules.') as ScheduleValidationError;
        error.code = 'SCHEDULE_LIMIT_EXCEEDED';
        throw error;
    }

    // Create schedule
    const { data, error } = await supabase
        .from('schedules')
        .insert([
            {
                user_id: user.id,
                label: scheduleData.label.trim(),
                start_date: scheduleData.start_date,
                end_date: scheduleData.end_date,
                status: 'draft'
            }
        ])
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create schedule: ${error.message}`);
    }

    return data;
}

// Get all schedules for current user (excluding trashed)
export async function getSchedules() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'trashed')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch schedules: ${error.message}`);
    }

    return data || [];
}

// Get single schedule by ID
export async function getSchedule(scheduleId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .eq('user_id', user.id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const notFoundError = new Error('Schedule not found') as ScheduleValidationError;
            notFoundError.code = 'SCHEDULE_NOT_FOUND';
            throw notFoundError;
        }
        throw new Error(`Failed to fetch schedule: ${error.message}`);
    }

    return data;
}

// Update schedule
export async function updateSchedule(scheduleId: string, updates: UpdateScheduleInput) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    // Get current scheudle to validate status transitions
    const currentSchedule = await getSchedule(scheduleId);

    // Validate status transitions
    if (updates.status) {
        const isValidTransition = validateStatusTransition(currentSchedule.status, updates.status);
        if (!isValidTransition) {
            const error = new Error(`Invalid status transition from ${currentSchedule.status} to ${updates.status}`) as ScheduleValidationError;
            error.code = 'INVALID_STATUS_TRANSITION';
            throw error;
        }
    }

    // Validate date range if dates updated
    const startDate = updates.start_date || currentSchedule.start_date;
    const endDate = updates.end_date || currentSchedule.end_date;

    if (new Date(startDate) >= new Date(endDate)) {
        const error = new Error('End date must be after start date') as ScheduleValidationError;
        error.code = 'INVALID_DATE_RANGE';
        throw error;
    }

    const updatePayload: any = {};

    if (updates.label !== undefined) {
        updatePayload.label = updates.label.trim();
    }
    if (updates.start_date !== undefined) {
        updatePayload.start_date = updates.start_date;
    }
    if (updates.end_date !== undefined) {
        updatePayload.end_date = updates.end_date;
    }
    if (updates.status !== undefined) {
        updatePayload.status = updates.status;
    }
    if (updates.send_confirmation_email !== undefined) {
        updatePayload.send_confirmation_email = updates.send_confirmation_email;
    }

    const { data, error } = await supabase
        .from('schedules')
        .update(updatePayload)
        .eq('id', scheduleId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const notFoundError = new Error('Schedule not found') as ScheduleValidationError;
            notFoundError.code = 'SCHEDULE_NOT_FOUND';
            throw notFoundError;
        }
        throw new Error(`Failed to update schedule: ${error.message}`);
    }

    return data;
}

// Transition schedule to collecting status (when form link is generated)
export async function activateSchedule(scheduleId: string) {
    return updateSchedule(scheduleId, { status: 'collecting' });
}

// Transition schedule to archived status (manual close or deadline hit)
export async function archiveSchedule(scheduleId: string) {
    return updateSchedule(scheduleId, { status: 'archived' });
}

// Soft delete -> move to trash
export async function deleteSchedule(scheduleId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    // First get current status of the schedule
    const { data: existingSchedule, error: fetchError } = await supabase
        .from('schedules')
        .select('id, status, previous_status')
        .eq('id', scheduleId)
        .single();

    if (fetchError || !existingSchedule) {
        const notFoundError = new Error('Schedule not found') as ScheduleValidationError;
        notFoundError.code = 'SCHEDULE_NOT_FOUND';
        throw notFoundError;
    }

    // Update to trashed status (RLS will handle user check)
    const { error } = await supabase
        .from('schedules')
        .update({
            status: 'trashed',
            deleted_at: new Date().toISOString(),
            previous_status: existingSchedule.status
        })
        .eq('id', scheduleId);

    if (error) {
        throw new Error(`Failed to delete schedule: ${error.message}`);
    }

    return { success: true };
}

// Restore from trash (restore to previous_status, or draft if not available)
export async function restoreSchedule(scheduleId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    // Get current schedule to get previous_status
    const currentSchedule = await getSchedule(scheduleId);

    // Check schedule limit before restoring
    const { data: existingSchedules, error: countError } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'trashed');

    if (countError) {
        throw new Error(`Failed to check schedule limit: ${countError.message}`);
    }

    if (existingSchedules && existingSchedules.length >= 3) {
        const error = new Error('Maximum of 3 schedules allowed. Please archive or delete existing schedules before restoring.') as ScheduleValidationError;
        error.code = 'SCHEDULE_LIMIT_EXCEEDED';
        throw error;
    }

    // Restore to previous_status, or 'collecting' if not available (archived schedules restore to collecting)
    const restoreStatus = currentSchedule.previous_status || 'collecting';

    // Validate status transition (allow restoring archived schedules to previous_status)
    if (currentSchedule.status === 'archived') {
        // Allow restoring archived schedule to its previous status (or collecting if not available)
        const { data: updateResult, error } = await supabase
            .from('schedules')
            .update({
                status: restoreStatus,
                deleted_at: null,
                previous_status: null
            })
            .eq('id', scheduleId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to restore schedule: ${error.message}`);
        }
        return updateResult;
    }

    // For non-archived schedules being restored from trash, use updateSchedule with validation
    const { data, error } = await supabase
        .from('schedules')
        .update({
            status: restoreStatus,
            deleted_at: null,
            previous_status: null
        })
        .eq('id', scheduleId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const notFoundError = new Error('Schedule not found') as ScheduleValidationError;
            notFoundError.code = 'SCHEDULE_NOT_FOUND';
            throw notFoundError;
        }
        throw new Error(`Failed to restore schedule: ${error.message}`);
    }

    return data;
}

// Get trashed schedules
export async function getTrashedSchedules() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'trashed')
        .order('deleted_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch trashed schedules: ${error.message}`);
    }

    return data || [];
}

// Get all schedules including trashed (for "All" filter)
export async function getAllSchedules() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch schedules: ${error.message}`);
    }

    return data || [];
}

// Permanent delete a single schedule (hard delete from database)
export async function permanentDeleteSchedule(scheduleId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error(`Failed to permanently delete schedule: ${error.message}`);
    }

    return { success: true };
}

// Permanently delete all trashed schedules
export async function permanentDeleteAllTrashed() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'trashed')
        .select('id');

    if (error) {
        throw new Error(`Failed to permanently delete trashed schedules: ${error.message}`);
    }

    return { success: true, count: data?.length || 0 };
}

// Helper function to validate status transitions
function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
    // Same status transition is always valid (allows editing same schedule)
    if (currentStatus === newStatus) return true;

    const validTransitions: Record<string, string[]> = {
        draft: ['collecting', 'trashed'],
        collecting: ['archived', 'trashed'],
        archived: ['collecting', 'trashed'], // Can restore to collecting or trash
        trashed: ['draft', 'collecting', 'archived'] // Can restore to any status
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// Utility function to check for date overlaps (for UI warnings)
export async function checkScheduleOverlaps(startDate: string, endDate: string, excludeScheduleId?: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    let query = supabase
        .from('schedules')
        .select('id, label, start_date, end_date')
        .eq('user_id', user.id)
        .neq('status', 'trashed');

    if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
    }

    const { data: schedules } = await query;

    if (!schedules) return [];

    // Check for date range overlaps
    const overlaps = schedules.filter(schedule => {
        const scheduleStart = new Date(schedule.start_date);
        const scheduleEnd = new Date(schedule.end_date);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        // Check if date ranges overlap
        return newStart <= scheduleEnd && newEnd >= scheduleStart;
    });

    return overlaps;
}

// Configure form settings and activate schedule
export async function updateFormConfig(scheduleId: string, config: FormConfigInput): Promise<Schedule> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

    // Validate max_choices
    if (config.max_choices !== undefined && (config.max_choices < 1 || config.max_choices > 3)) {
        throw new Error('max_choices must be between 1 and 3');
    }

    // Build update payload
    const updatePayload: any = {};
    if (config.max_choices !== undefined) updatePayload.max_choices = config.max_choices;
    if (config.form_instructions !== undefined) updatePayload.form_instructions = config.form_instructions;
    if (config.form_deadline !== undefined) updatePayload.form_deadline = config.form_deadline;

    // Update schedule configuration and set status to 'collecting'
    const { data, error } = await supabase
        .from('schedules')
        .update({
            ...updatePayload,
            status: 'collecting'
        })
        .eq('id', scheduleId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const notFoundError = new Error('Schedule not found') as ScheduleValidationError;
            notFoundError.code = 'SCHEDULE_NOT_FOUND';
            throw notFoundError;
        }
        throw new Error(`Failed to configure form: ${error.message}`);
    }

    return data;
}

// ============================================
// AI Assistant Wrapper Functions
// These wrap the core functions for Aria to use
// ============================================

// Alias for deleteSchedule - moves schedule to trash
export async function trashSchedule(scheduleId: string) {
    return deleteSchedule(scheduleId);
}

// Alias for restoreSchedule - restores from trash to previous status
export async function recoverSchedule(scheduleId: string) {
    return restoreSchedule(scheduleId);
}

// Permanently delete all trashed schedules (use with confirmation)
export async function emptyTrash() {
    return permanentDeleteAllTrashed();
}

// ============================================
// Event Wrapper Functions for AI Assistant
// ============================================

// Add an event to a schedule
export async function addEventToSchedule(args: {
    schedule_id: string;
    student_name: string;
    day: string;         // 'Monday', 'Tuesday', etc.
    hour: number;        // 0-23 (e.g., 15 for 3pm)
    start_time?: string; // HH:MM format (optional, defaults to hour:00)
    end_time?: string;   // HH:MM format (optional, defaults to hour+1:00)
    recurrence_rule?: string; // e.g., 'FREQ=WEEKLY;BYDAY=MO' for weekly
}) {
    // Resolve schedule_id: allow passing a label; fetch actual UUID if needed
    let resolvedScheduleId = args.schedule_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resolvedScheduleId)) {
        // Load all schedules to resolve exact match or report ambiguity
        const all = await getSchedules();
        const exactMatches = all.filter(s => s.label.toLowerCase() === String(args.schedule_id).toLowerCase());
        if (exactMatches.length === 1) {
            resolvedScheduleId = exactMatches[0].id;
        } else if (exactMatches.length > 1) {
            throw new Error(`Multiple schedules match '${args.schedule_id}'. Available: ${all.map(s => s.label).join(', ')}`);
        } else {
            throw new Error(`Schedule not found: ${args.schedule_id}. Available: ${all.map(s => s.label).join(', ')}`);
        }
        // resolvedScheduleId now is a UUID
    }
    // Get the schedule to find its start date
    const schedule = await getSchedule(resolvedScheduleId);

    // Calculate the first occurrence of the requested day within the schedule's date range
    const firstDate = findFirstDayOccurrence(schedule.start_date, args.day);

    const start = args.start_time || `${args.hour.toString().padStart(2, '0')}:00`;
    const end = args.end_time || `${(args.hour + 1).toString().padStart(2, '0')}:00`;

    // Create Date objects in local time, then convert to ISO string
    // This ensures the time displays correctly in the user's timezone
    const startDate = new Date(`${firstDate}T${start}:00`);
    const endDate = new Date(`${firstDate}T${end}:00`);

    // Use toISOString() which converts local time to UTC - this is correct
    // because when the SchedulePage reads it back, new Date() will convert UTC back to local
    const start_time = startDate.toISOString();
    const end_time = endDate.toISOString();

    // Default to weekly recurrence if day is specified but no recurrence_rule provided
    // Map day name to RRULE BYDAY abbreviation
    const dayAbbrevMap: Record<string, string> = {
        'Sunday': 'SU', 'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE',
        'Thursday': 'TH', 'Friday': 'FR', 'Saturday': 'SA'
    };
    const dayAbbrev = dayAbbrevMap[args.day];
    const defaultRecurrence = dayAbbrev ? `FREQ=WEEKLY;BYDAY=${dayAbbrev}` : '';

    return createScheduleEntry({
        schedule_id: resolvedScheduleId,
        student_name: args.student_name,
        start_time,
        end_time,
        recurrence_rule: args.recurrence_rule ?? defaultRecurrence
    });
}

// (removed duplicate function)

// Update or move an event in a schedule
export async function updateEventInSchedule(args: {
    event_id: string;
    student_name?: string;
    day?: string;
    hour?: number;
    start_time?: string;
    end_time?: string;
    recurrence_rule?: string;
}) {
    const updates: { student_name?: string; start_time?: string; end_time?: string; recurrence_rule?: string } = {};

    if (args.student_name !== undefined) updates.student_name = args.student_name;
    if (args.recurrence_rule !== undefined) updates.recurrence_rule = args.recurrence_rule;

    if (args.day !== undefined && args.hour !== undefined) {
        // Get the original event to find the schedule and calculate new date
        const originalEntry = await getScheduleEntryById(args.event_id);
        const schedule = await getSchedule(originalEntry.schedule_id);

        // Calculate the first occurrence of the new day within the schedule's date range
        const firstDate = findFirstDayOccurrence(schedule.start_date, args.day);

        const start = args.start_time || `${args.hour.toString().padStart(2, '0')}:00`;
        const end = args.end_time || `${(args.hour + 1).toString().padStart(2, '0')}:00`;

        updates.start_time = `${firstDate}T${start}:00`;
        updates.end_time = `${firstDate}T${end}:00`;
    } else if (args.start_time !== undefined) {
        updates.start_time = args.start_time;
    } else if (args.end_time !== undefined) {
        updates.end_time = args.end_time;
    }

    return updateScheduleEntry(args.event_id, updates);
}

// Atomic-like swap of two events
// Uses a 3-step process to avoid collision constraints: A -> Temp, B -> A, Temp -> B
export async function swapEvents(event1_id: string, event2_id: string) {
    // 1. Get both events
    const entry1 = await getScheduleEntryById(event1_id);
    const entry2 = await getScheduleEntryById(event2_id);

    // Store original times
    const time1 = { start: entry1.start_time, end: entry1.end_time };
    const time2 = { start: entry2.start_time, end: entry2.end_time };

    // 2. Move Event 1 to a temporary safe holding spot (e.g., 100 years in the future to keep day of week)
    // We add 5200 weeks (~100 years) to maintain the same day-of-week logic if needed, 
    // though for single events just shifting the year is enough.
    // Let's just use a very far future date.
    const tempStart = new Date(time1.start);
    tempStart.setFullYear(tempStart.getFullYear() + 100);
    const tempEnd = new Date(time1.end);
    tempEnd.setFullYear(tempEnd.getFullYear() + 100);

    await updateScheduleEntry(event1_id, {
        start_time: tempStart.toISOString(),
        end_time: tempEnd.toISOString()
    });

    // 3. Move Event 2 to Event 1's ORIGINAL time
    await updateScheduleEntry(event2_id, {
        start_time: time1.start,
        end_time: time1.end
    });

    // 4. Move Event 1 (from temp) to Event 2's ORIGINAL time
    const updatedEntry1 = await updateScheduleEntry(event1_id, {
        start_time: time2.start,
        end_time: time2.end
    });

    // Re-fetch Entry 2 to return updated state
    const updatedEntry2 = await getScheduleEntryById(event2_id);

    return [updatedEntry1, updatedEntry2];
}

// Helper to get a single schedule entry by ID
async function getScheduleEntryById(entryId: string) {
    const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('id', entryId)
        .single();

    if (error || !data) {
        throw new Error('Event not found');
    }

    return data;
}

// Delete an event from a schedule
export async function deleteEventFromSchedule(args: { event_id: string }) {
    return deleteScheduleEntry(args.event_id);
}

// Get event summary grouped by day (for AI context)
// Returns event IDs so AI can update/delete events
export async function getEventSummaryInSchedule(scheduleId: string) {
    const entries = await getScheduleEntries(scheduleId);

    // Group by day (Sunday = 0, Monday = 1, etc. in JS)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const summary: Record<string, Array<{ id: string; name: string; time: string }>> = {};

    days.forEach(day => summary[day] = []);

    entries.forEach(entry => {
        // Parse date in LOCAL time (new Date() converts UTC to local automatically)
        const date = new Date(entry.start_time);
        const dayName = days[date.getDay()];

        // Format time in local timezone (HH:MM format)
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const time = `${hours}:${minutes}`;

        summary[dayName].push({
            id: entry.id,  // Include ID so AI can delete/update
            name: entry.student_name,
            time: time
        });
    });

    return summary;
}

// ============================================
// Participant Wrapper Functions for AI Assistant
// ============================================

// List unassigned participants in a schedule
export async function listUnassignedParticipants(scheduleId: string) {
    const responses = await getFormResponses(scheduleId);
    return responses.filter(r => !r.assigned);
}

// Get participant preferences
export async function getParticipantPreferences(participantId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .from('form_responses')
        .select('*')
        .eq('id', participantId)
        .eq('user_id', user.id)
        .single();

    if (error) {
        throw new Error(`Failed to fetch participant: ${error.message}`);
    }

    if (!data) {
        throw new Error('Participant not found');
    }

    // Return formatted preferences
    return {
        id: data.id,
        student_name: data.student_name,
        email: data.email,
        preferences: getPreferredTimings(data),
        assigned: data.assigned
    };
}

// Mark a participant as assigned
export async function markParticipantAssigned(participantId: string, assigned: boolean = true) {
    return updateFormResponseAssigned(participantId, assigned);
}
