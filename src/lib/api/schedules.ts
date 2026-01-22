import { supabase } from "../supabase";

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
