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

// Get exceptions for entries (returns map of entryId -> exception dates)
export async function getEntryExceptions(entryIds: string[]): Promise<Record<string, string[]>> {
    if (entryIds.length === 0) return {};
    
    const { data, error } = await supabase
        .from('schedule_entry_exceptions')
        .select('entry_id, exception_date')
        .in('entry_id', entryIds);
    
    if (error) {
        console.warn('Failed to fetch exceptions:', error.message);
        return {};
    }
    
    const exceptionsMap: Record<string, string[]> = {};
    for (const row of data || []) {
        if (!exceptionsMap[row.entry_id]) {
            exceptionsMap[row.entry_id] = [];
        }
        exceptionsMap[row.entry_id].push(row.exception_date);
    }
    
    return exceptionsMap;
}

// Add exception date (to skip/hide a specific occurrence)
export async function addEntryException(entryId: string, exceptionDate: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_entry_exceptions')
        .insert([{
            entry_id: entryId,
            exception_date: exceptionDate, // YYYY-MM-DD format
        }]);
    
    if (error) {
        throw new Error(`Failed to add exception: ${error.message}`);
    }
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

// Delete schedule entry - for non-recurring: just delete
// For recurring: add an exception for this date (skip this occurrence)
export async function deleteScheduleEntry(entryId: string): Promise<void> {
    // First get the entry
    const { data: entry, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('id', entryId)
        .single();
    
    if (fetchError || !entry) {
        console.log('Entry not found or already deleted');
        return;
    }
    
    // Check if this is a recurring entry
    if (entry.recurrence_rule && entry.recurrence_rule !== '') {
        // For recurring entries: add an exception for this date
        // The entry stays in DB, calendar will skip this date
        const entryDate = new Date(entry.start_time);
        const exceptionDate = entryDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        await addEntryException(entryId, exceptionDate);
        console.log('Added exception for', exceptionDate);
    } else {
        // Non-recurring: just delete
        const { error } = await supabase
            .from('schedule_entries')
            .delete()
            .eq('id', entryId);
        
        if (error) {
            throw new Error(`Failed to delete: ${error.message}`);
        }
    }
}

// Delete this entry and all subsequent entries with the same student_name and recurrence_rule
export async function deleteThisAndSubsequentEntries(entryId: string, startTime: string): Promise<void> {
    const { data: entry, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('student_name, recurrence_rule')
        .eq('id', entryId)
        .single();
    
    if (fetchError) {
        throw new Error(`Failed to fetch entry: ${fetchError.message}`);
    }
    
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
