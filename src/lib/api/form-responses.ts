import { supabase } from "../supabase";

export interface PreferredTiming {
    day: string;      // 'Monday', 'Tuesday', etc.
    start: string;    // HH:MM format
    end: string;      // HH:MM format
    frequency: string; // 'once', 'weekly', '2weekly', 'monthly'
    duration?: number; // Calculated duration in minutes
}

export interface FormResponse {
    id: string;
    schedule_id: string;
    student_name: string;
    email: string;
    top_choices: string[]; // Array of ISO 8601 datetime strings
    assigned: boolean; // Whether the participant has been assigned to a schedule slot
    // Preferred timings (new)
    preferred_1_day?: string;
    preferred_1_start?: string;
    preferred_1_end?: string;
    preferred_1_frequency?: string;
    preferred_2_day?: string;
    preferred_2_start?: string;
    preferred_2_end?: string;
    preferred_2_frequency?: string;
    preferred_3_day?: string;
    preferred_3_start?: string;
    preferred_3_end?: string;
    preferred_3_frequency?: string;
}

export function calculateDurationMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);
    return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

export interface CreateFormResponseInput {
    schedule_id: string;
    student_name: string;
    email?: string;
    top_choices?: string[];
    preferred_1_day?: string;
    preferred_1_start?: string;
    preferred_1_end?: string;
    preferred_1_frequency?: string;
    preferred_2_day?: string;
    preferred_2_start?: string;
    preferred_2_end?: string;
    preferred_2_frequency?: string;
    preferred_3_day?: string;
    preferred_3_start?: string;
    preferred_3_end?: string;
    preferred_3_frequency?: string;
}

// Get all form responses for a schedule
export async function getFormResponses(scheduleId: string): Promise<FormResponse[]> {
    const { data, error } = await supabase
        .from('form_responses')
        .select('*')
        .eq('schedule_id', scheduleId);
    
    if (error) {
        throw new Error(`Failed to fetch form responses: ${error.message}`);
    }

    return data || [];
}

// Create a new form response (student submission)
export async function createFormResponse(response: CreateFormResponseInput): Promise<FormResponse> {
    const { data, error } = await supabase
        .from('form_responses')
        .insert([response])
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to create form response: ${error.message}`);
    }

    return data;
}

// Delete form response
export async function deleteFormResponse(responseId: string): Promise<void> {
    const { error } = await supabase
        .from('form_responses')
        .delete()
        .eq('id', responseId);
    
    if (error) {
        throw new Error(`Failed to delete form response: ${error.message}`);
    }
}

// Update form response assigned status
export async function updateFormResponseAssigned(responseId: string, assigned: boolean): Promise<FormResponse> {
    const { data, error } = await supabase
        .from('form_responses')
        .update({ assigned })
        .eq('id', responseId)
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to update form response: ${error.message}`);
    }

    return data;
}

// Get preferred timings as an array for a form response
export function getPreferredTimings(response: FormResponse): PreferredTiming[] {
    const timings: PreferredTiming[] = [];
    
    if (response.preferred_1_day && response.preferred_1_start && response.preferred_1_end) {
        const duration = calculateDurationMinutes(response.preferred_1_start, response.preferred_1_end);
        timings.push({
            day: response.preferred_1_day,
            start: response.preferred_1_start,
            end: response.preferred_1_end,
            frequency: response.preferred_1_frequency || 'weekly',
            duration,
        });
    }
    
    if (response.preferred_2_day && response.preferred_2_start && response.preferred_2_end) {
        const duration = calculateDurationMinutes(response.preferred_2_start, response.preferred_2_end);
        timings.push({
            day: response.preferred_2_day,
            start: response.preferred_2_start,
            end: response.preferred_2_end,
            frequency: response.preferred_2_frequency || 'weekly',
            duration,
        });
    }
    
    if (response.preferred_3_day && response.preferred_3_start && response.preferred_3_end) {
        const duration = calculateDurationMinutes(response.preferred_3_start, response.preferred_3_end);
        timings.push({
            day: response.preferred_3_day,
            start: response.preferred_3_start,
            end: response.preferred_3_end,
            frequency: response.preferred_3_frequency || 'weekly',
            duration,
        });
    }
    
    return timings;
}
