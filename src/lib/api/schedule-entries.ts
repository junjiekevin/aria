// src/lib/api/schedule-entries.ts
// Data access layer for the schedule_entries table.
// Pure Supabase CRUD only. No business logic.

import { supabase } from '../supabase';

// ============================================
// Types
// ============================================

export interface ScheduleEntry {
    id: string;
    schedule_id: string;
    student_name: string;
    start_time: string;
    end_time: string;
    recurrence_rule: string;
    participant_id?: string | null;
    updated_at: string;
}

export interface CreateScheduleEntryInput {
    schedule_id: string;
    student_name: string;
    start_time: string;
    end_time: string;
    recurrence_rule: string;
    participant_id?: string | null;
}

// ============================================
// Helpers
// ============================================

export function isRecurringEntry(entry: ScheduleEntry): boolean {
    return !!entry.recurrence_rule && entry.recurrence_rule !== '';
}

// ============================================
// CRUD
// ============================================

export async function getScheduleEntries(scheduleId: string): Promise<ScheduleEntry[]> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('start_time', { ascending: true });

    if (error) throw new Error(`Failed to fetch schedule entries: ${error.message}`);
    return data || [];
}

// Creates a new schedule entry.
// Idempotency check: if an entry with the same schedule_id, student_name,
// start_time, and recurrence_rule already exists, returns the existing entry
// instead of inserting a duplicate. Protects against AI double-fire.
export async function createScheduleEntry(
    entry: CreateScheduleEntryInput
): Promise<ScheduleEntry> {
    // Check for exact duplicate before inserting
    const { data: existing } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_id', entry.schedule_id)
        .eq('student_name', entry.student_name)
        .eq('start_time', entry.start_time)
        .eq('recurrence_rule', entry.recurrence_rule)
        .maybeSingle();

    if (existing) {
        console.info(
            `[schedule-entries] Idempotency hit — returning existing entry for "${entry.student_name}" at ${entry.start_time}`
        );
        return existing;
    }

    const { data, error } = await supabase
        .from('schedule_entries')
        .insert([entry])
        .select()
        .single();

    if (error) throw new Error(`Failed to create schedule entry: ${error.message}`);
    return data;
}

export async function updateScheduleEntry(
    entryId: string,
    updates: {
        student_name?: string;
        start_time?: string;
        end_time?: string;
        recurrence_rule?: string;
    }
): Promise<ScheduleEntry> {
    const { data, error } = await supabase
        .from('schedule_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update schedule entry: ${error.message}`);
    return data;
}

export async function deleteScheduleEntry(entryId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', entryId);

    if (error) throw new Error(`Failed to delete schedule entry: ${error.message}`);
}
