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

    console.log('getScheduleEntries - fetched from DB:', data?.length || 0, 'entries');
    
    return data || [];
}

// Get exceptions for an entry
export async function getEntryExceptions(entryId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('schedule_entry_exceptions')
        .select('exception_date')
        .eq('entry_id', entryId);
    
    if (error) {
        console.warn('Failed to fetch exceptions:', error.message);
        return [];
    }
    
    return data?.map(row => row.exception_date) || [];
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

// Remove exception date
export async function removeEntryException(exceptionId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_entry_exceptions')
        .delete()
        .eq('id', exceptionId);
    
    if (error) {
        throw new Error(`Failed to remove exception: ${error.message}`);
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

// Delete schedule entry - for "this event only" on recurring entries, add an exception
export async function deleteScheduleEntry(entryId: string): Promise<void> {
    console.log('Deleting entry by ID:', entryId);
    
    // First get the full entry
    const { data: entry, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('id', entryId)
        .single();
    
    if (fetchError || !entry) {
        console.log('Entry not found or already deleted');
        return;
    }
    
    console.log('Found entry to delete:', entry);
    
    // Check if this is a recurring entry
    if (entry.recurrence_rule && entry.recurrence_rule !== '') {
        // For recurring entries: add an exception instead of deleting
        // The date to skip is the entry's start_time date
        const entryDate = new Date(entry.start_time);
        const exceptionDate = entryDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        console.log('Recurring entry - adding exception for:', exceptionDate);
        
        await addEntryException(entryId, exceptionDate);
        
        console.log('Added exception - entry stays in DB, calendar will skip this date');
    } else {
        // Non-recurring: just delete
        const { error, count } = await supabase
            .from('schedule_entries')
            .delete({ count: 'exact' })
            .eq('id', entryId);
        
        console.log('Delete result - count:', count, 'error:', error);
        
        if (error) {
            throw new Error(`Failed to delete: ${error.message}`);
        }
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
