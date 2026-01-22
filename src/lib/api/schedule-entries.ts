import { supabase } from "../supabase";

export interface ScheduleEntry {
    id: string;
    schedule_id: string;
    student_name: string;
    start_time: string; // ISO 8601 datetime
    end_time: string;   // ISO 8601 datetime
    recurrence_rule: string; // iCal RRULE format (e.g., "FREQ=WEEKLY;BYDAY=MO")
}

export interface CreateScheduleEntryInput {
    schedule_id: string;
    student_name: string;
    start_time: string;
    end_time: string;
    recurrence_rule: string;
}

// Check if an entry is recurring
export function isRecurringEntry(entry: ScheduleEntry): boolean {
    return entry.recurrence_rule !== '' && entry.recurrence_rule !== null;
}

// Get all entries for a schedule
export async function getScheduleEntries(scheduleId: string): Promise<ScheduleEntry[]> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('start_time', { ascending: true });
    
    if (error) {
        throw new Error(`Failed to fetch schedule entries: ${error.message}`);
    }
    
    return data || [];
}

// Create a new schedule entry
export async function createScheduleEntry(entry: CreateScheduleEntryInput): Promise<ScheduleEntry> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .insert([entry])
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to create schedule entry: ${error.message}`);
    }

    return data;
}

// Update schedule entry time
export async function updateScheduleEntry(
    entryId: string, 
    updates: { student_name?: string; start_time?: string; end_time?: string; recurrence_rule?: string }
): Promise<ScheduleEntry> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to update schedule entry: ${error.message}`);
    }

    return data;
}

// Delete schedule entry - just delete it
export async function deleteScheduleEntry(entryId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', entryId);
    
    if (error) {
        throw new Error(`Failed to delete: ${error.message}`);
    }
}

// Split a recurring entry: keep current as single, create new for future
export async function splitRecurringEntry(
    entry: ScheduleEntry,
    newStartTime: string,
    newEndTime: string,
    newRecurrenceRule: string
): Promise<void> {
    // Step 1: Convert current entry to single occurrence (remove recurrence rule)
    await updateScheduleEntry(entry.id, {
        start_time: entry.start_time,  // Keep original time for this occurrence
        end_time: entry.end_time,
        recurrence_rule: ''  // Remove recurrence to keep only this occurrence
    });
    
    // Step 2: Create new entry for future occurrences
    await createScheduleEntry({
        schedule_id: entry.schedule_id,
        student_name: entry.student_name,
        start_time: newStartTime,
        end_time: newEndTime,
        recurrence_rule: newRecurrenceRule
    });
}

// Delete all future occurrences of a recurring entry
// Converts current entry to single occurrence (preserves history)
export async function deleteFutureEntries(entry: ScheduleEntry): Promise<void> {
    // Convert current entry to single occurrence
    await updateScheduleEntry(entry.id, {
        recurrence_rule: ''  // Remove recurrence rule
    });
}
