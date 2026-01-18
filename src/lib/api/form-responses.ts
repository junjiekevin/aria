import { supabase } from "../supabase";

export interface FormResponse {
    id: string;
    schedule_id: string;
    student_name: string;
    email: string;
    top_choices: string[]; // Array of ISO 8601 datetime strings
}

export interface CreateFormResponseInput {
    schedule_id: string;
    student_name: string;
    email: string;
    top_choices: string[];
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
