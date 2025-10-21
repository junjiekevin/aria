import { supabase } from "../supabase";

export interface Schedule {
    id: string;
    user_id: string;
    label: string;
    start_date: string; // YYYY-MM-DD Format
    end_date: string; // YYYY-MM-DD Format
    status: 'draft' | 'collecting' | 'archived' | 'trashed';
    deleted_at: string | null;
    created_at: string;
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
}

export interface ScheduleValidationError extends Error {
    code: 'SCHEDULE_LIMIT_EXCEEDED' | 'INVALID_DATE_RANGE' | 'INVALID_STATUS_TRANSITION' | 'SCHEDULE_NOT_FOUND' | 'UNAUTHORIZED';
}

// Create new schedule
export async function createSchedule(scheduleData: CreateScheduleInput) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error ('User not authenticated') as ScheduleValidationError;
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

    const { data, error } = await supabase
        .from('schedules')
        .update({
            status: 'trashed',
            deleted_at: new Date().toISOString()
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
        throw new Error(`Failed to delete schedule: ${error.message}`);
    }

    return data;
}

// Restore from trash (can only restore to draft, not archived)
export async function restoreSchedule(scheduleId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const error = new Error('User not authenticated') as ScheduleValidationError;
        error.code = 'UNAUTHORIZED';
        throw error;
    }

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

    const { data, error } = await supabase
        .from('schedules')
        .update({
            status: 'draft',
            deleted_at: null
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

// Helper function to validate status transitions
function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
        draft: ['collecting', 'trashed'],
        collecting: ['archived', 'trashed'],
        archived: ['trashed'], // Archived schedules cannot go back
        trashed: ['draft'] // Can only restore to draft, not archived
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
