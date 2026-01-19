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
// For recurring: delete this occurrence and create new entry starting next week
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
        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);
        const now = new Date();
        
        // Check if this occurrence is in the past
        if (entryStart < now) {
            console.log('This occurrence is in the past - deleting without replacement');
            const { error } = await supabase
                .from('schedule_entries')
                .delete()
                .eq('id', entryId);
            
            if (error) {
                throw new Error(`Failed to delete: ${error.message}`);
            }
            return;
        }
        
        // For future occurrences: delete this one AND create new one starting next week
        console.log('Future recurring entry - will create replacement starting next week');
        
        // Create new entry starting 7 days later (next occurrence)
        const nextStart = new Date(entryStart);
        nextStart.setDate(nextStart.getDate() + 7);
        
        const nextEnd = new Date(entryEnd);
        nextEnd.setDate(nextEnd.getDate() + 7);
        
        // Delete old entry
        const { error: deleteError } = await supabase
            .from('schedule_entries')
            .delete()
            .eq('id', entryId);
        
        if (deleteError) {
            throw new Error(`Failed to delete: ${deleteError.message}`);
        }
        
        // Create replacement entry (next week's occurrence)
        const { error: createError } = await supabase
            .from('schedule_entries')
            .insert([{
                schedule_id: entry.schedule_id,
                student_name: entry.student_name,
                start_time: nextStart.toISOString(),
                end_time: nextEnd.toISOString(),
                recurrence_rule: entry.recurrence_rule,
            }]);
        
        if (createError) {
            throw new Error(`Failed to create replacement entry: ${createError.message}`);
        }
        
        console.log('Deleted this occurrence, created replacement starting:', nextStart);
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
