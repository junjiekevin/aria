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

// Delete schedule entry - ensures ONLY this specific entry is deleted
export async function deleteScheduleEntry(entryId: string): Promise<void> {
    // Log for debugging
    console.log('Deleting entry by ID:', entryId);
    
    // First verify the entry exists
    const { data: verify, error: verifyError } = await supabase
        .from('schedule_entries')
        .select('id, student_name')
        .eq('id', entryId)
        .single();
    
    if (verifyError || !verify) {
        console.log('Entry not found or already deleted:', entryId);
        if (verifyError) {
            throw new Error(`Entry not found: ${verifyError.message}`);
        }
        return;
    }
    
    console.log('Found entry to delete:', verify);
    
    // Delete ONLY this entry by ID
    const { error, count } = await supabase
        .from('schedule_entries')
        .delete({ count: 'exact' })
        .eq('id', entryId);
    
    console.log('Delete result - count:', count, 'error:', error);
    
    if (error) {
        throw new Error(`Failed to delete: ${error.message}`);
    }
    
    if (count !== 1) {
        console.warn('Unexpected: deleted', count, 'entries instead of 1');
    }
}

// Delete ONLY this occurrence (not future ones) - for recurring entries
export async function deleteThisOccurrenceOnly(entryId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', entryId);
    
    if (error) {
        throw new Error(`Failed to delete occurrence: ${error.message}`);
    }
}

// Delete this entry and all subsequent entries with the same student_name and recurrence_rule
export async function deleteThisAndSubsequentEntries(entryId: string, startTime: string): Promise<void> {
    // First, get the entry to find student_name and recurrence_rule
    const { data: entry, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('student_name, recurrence_rule')
        .eq('id', entryId)
        .single();
    
    if (fetchError) {
        throw new Error(`Failed to fetch entry: ${fetchError.message}`);
    }
    
    // Delete this entry and all subsequent entries for same student with same recurrence rule
    const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('student_name', entry.student_name)
        .eq('recurrence_rule', entry.recurrence_rule)
        .gte('start_time', startTime);
    
    if (error) {
        throw new Error(`Failed to delete entries: ${error.message}`);
    }
}
