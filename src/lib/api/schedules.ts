// src/lib/api/schedules.ts
// Data access layer for the schedules table.
// Pure Supabase CRUD only. No business logic, no validation, no orchestration.
// All business logic lives in src/lib/services/scheduleService.ts.

import { supabase } from '../supabase';

// ============================================
// Types
// ============================================

export interface Schedule {
    id: string;
    user_id: string;
    label: string;
    start_date: string;
    end_date: string;
    status: 'draft' | 'collecting' | 'published' | 'archived' | 'trashed';
    deleted_at: string | null;
    previous_status: 'draft' | 'collecting' | 'published' | 'archived' | null;
    send_confirmation_email: boolean;
    cancellation_policy_hours: number;
    created_at: string;
    max_choices: number;
    form_instructions: string | null;
    form_deadline: string | null;
    working_hours_start: number;
    working_hours_end: number;
}

export interface FormConfigInput {
    max_choices?: number;
    form_instructions?: string | null;
    form_deadline?: string | null;
    working_hours_start?: number;
    working_hours_end?: number;
    cancellation_policy_hours?: number;
}

export interface CreateScheduleInput {
    label: string;
    start_date: string;
    end_date: string;
    working_hours_start?: number;
    working_hours_end?: number;
}

export interface UpdateScheduleInput {
    label?: string;
    start_date?: string;
    end_date?: string;
    status?: 'draft' | 'collecting' | 'published' | 'archived' | 'trashed';
    send_confirmation_email?: boolean;
    previous_status?: 'draft' | 'collecting' | 'published' | 'archived' | null;
    working_hours_start?: number;
    working_hours_end?: number;
    cancellation_policy_hours?: number;
}

// ============================================
// Helpers
// ============================================

async function getAuthenticatedUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('UNAUTHORIZED');
    return user.id;
}

// ============================================
// CRUD
// ============================================

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    const userId = await getAuthenticatedUserId();

    // Check schedule limit (max 3 active)
    const { data: existing, error: countErr } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', userId)
        .neq('status', 'trashed');

    if (countErr) throw new Error(`Failed to check schedule limit: ${countErr.message}`);
    if (existing && existing.length >= 3) {
        throw new Error('SCHEDULE_LIMIT_EXCEEDED');
    }

    const { data, error } = await supabase
        .from('schedules')
        .insert([{
            user_id: userId,
            label: input.label.trim(),
            start_date: input.start_date,
            end_date: input.end_date,
            status: 'draft',
            working_hours_start: input.working_hours_start ?? 8,
            working_hours_end: input.working_hours_end ?? 21,
        }])
        .select()
        .single();

    if (error) throw new Error(`Failed to create schedule: ${error.message}`);
    return data;
}

export async function getSchedule(scheduleId: string): Promise<Schedule> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('NOT_FOUND');
        throw new Error(`Failed to fetch schedule: ${error.message}`);
    }
    return data;
}

// Public read — no auth. RLS enforces status = collecting | archived.
export async function getPublicSchedule(scheduleId: string): Promise<Partial<Schedule>> {
    const { data, error } = await supabase
        .from('schedules')
        .select('id, label, start_date, end_date, status, max_choices, form_instructions, form_deadline, working_hours_start, working_hours_end')
        .eq('id', scheduleId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('NOT_FOUND');
        throw new Error(`Failed to fetch public schedule: ${error.message}`);
    }
    return data;
}

export async function getSchedules(): Promise<Schedule[]> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'trashed')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch schedules: ${error.message}`);
    return data || [];
}

export async function getAllSchedules(): Promise<Schedule[]> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch all schedules: ${error.message}`);
    return data || [];
}

export async function getTrashedSchedules(): Promise<Schedule[]> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'trashed')
        .order('deleted_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch trashed schedules: ${error.message}`);
    return data || [];
}

export async function updateSchedule(
    scheduleId: string,
    updates: UpdateScheduleInput
): Promise<Schedule> {
    const userId = await getAuthenticatedUserId();

    const payload: Record<string, unknown> = {};
    if (updates.label !== undefined)                     payload.label = updates.label.trim();
    if (updates.start_date !== undefined)                payload.start_date = updates.start_date;
    if (updates.end_date !== undefined)                  payload.end_date = updates.end_date;
    if (updates.status !== undefined)                    payload.status = updates.status;
    if (updates.send_confirmation_email !== undefined)   payload.send_confirmation_email = updates.send_confirmation_email;
    if (updates.previous_status !== undefined)           payload.previous_status = updates.previous_status;
    if (updates.working_hours_start !== undefined)       payload.working_hours_start = updates.working_hours_start;
    if (updates.working_hours_end !== undefined)         payload.working_hours_end = updates.working_hours_end;
    if (updates.cancellation_policy_hours !== undefined) payload.cancellation_policy_hours = updates.cancellation_policy_hours;

    const { data, error } = await supabase
        .from('schedules')
        .update(payload)
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('NOT_FOUND');
        throw new Error(`Failed to update schedule: ${error.message}`);
    }
    return data;
}

// Soft delete — moves to trash, saves previous_status for restore
export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean }> {
    const userId = await getAuthenticatedUserId();

    const { data: existing, error: fetchErr } = await supabase
        .from('schedules')
        .select('id, status')
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .single();

    if (fetchErr || !existing) throw new Error('NOT_FOUND');

    const { error } = await supabase
        .from('schedules')
        .update({
            status: 'trashed',
            deleted_at: new Date().toISOString(),
            previous_status: existing.status,
        })
        .eq('id', scheduleId)
        .eq('user_id', userId);

    if (error) throw new Error(`Failed to trash schedule: ${error.message}`);
    return { success: true };
}

export async function permanentDeleteSchedule(
    scheduleId: string
): Promise<{ success: boolean }> {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('user_id', userId);

    if (error) throw new Error(`Failed to permanently delete schedule: ${error.message}`);
    return { success: true };
}

export async function permanentDeleteAllTrashed(): Promise<{
    success: boolean;
    count: number;
}> {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'trashed')
        .select('id');

    if (error) throw new Error(`Failed to empty trash: ${error.message}`);
    return { success: true, count: data?.length ?? 0 };
}

export async function updateFormConfig(
    scheduleId: string,
    config: FormConfigInput
): Promise<Schedule> {
    const userId = await getAuthenticatedUserId();

    const payload: Record<string, unknown> = { status: 'collecting' };
    if (config.max_choices !== undefined)               payload.max_choices = config.max_choices;
    if (config.form_instructions !== undefined)         payload.form_instructions = config.form_instructions;
    if (config.form_deadline !== undefined)             payload.form_deadline = config.form_deadline;
    if (config.working_hours_start !== undefined)       payload.working_hours_start = config.working_hours_start;
    if (config.working_hours_end !== undefined)         payload.working_hours_end = config.working_hours_end;
    if (config.cancellation_policy_hours !== undefined) payload.cancellation_policy_hours = config.cancellation_policy_hours;

    const { data, error } = await supabase
        .from('schedules')
        .update(payload)
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116') throw new Error('NOT_FOUND');
        throw new Error(`Failed to update form config: ${error.message}`);
    }
    return data;
}

export async function checkScheduleOverlaps(
    startDate: string,
    endDate: string,
    excludeScheduleId?: string
): Promise<Schedule[]> {
    const userId = await getAuthenticatedUserId();

    let query = supabase
        .from('schedules')
        .select('id, label, start_date, end_date')
        .eq('user_id', userId)
        .neq('status', 'trashed');

    if (excludeScheduleId) query = query.neq('id', excludeScheduleId);

    const { data: schedules } = await query;
    if (!schedules) return [];

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    return schedules.filter(s => {
        const sStart = new Date(s.start_date);
        const sEnd = new Date(s.end_date);
        return newStart <= sEnd && newEnd >= sStart;
    }) as Schedule[];
}

// Resolves a schedule UUID from a label string.
// Returns null if not found or ambiguous.
export async function resolveScheduleIdByLabel(label: string): Promise<string | null> {
    const schedules = await getSchedules();
    const matches = schedules.filter(
        s => s.label.toLowerCase() === label.toLowerCase()
    );
    if (matches.length === 1) return matches[0].id;
    return null;
}
