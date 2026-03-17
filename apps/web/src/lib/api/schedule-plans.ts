// src/lib/api/schedule-plans.ts
// Data access layer for the schedule_plans table.
// Pure Supabase CRUD only. No business logic.

import { supabase } from '../supabase';

// ============================================
// Types
// ============================================

export type PlanAction = 'add' | 'move' | 'swap' | 'delete' | 'update';

export interface PlanChange {
    action: PlanAction;
    target: string;          // entry ID or participant name
    description: string;     // Human-readable summary
    before?: {
        day?: string;
        start_time?: string;
        end_time?: string;
        recurrence_rule?: string;
    };
    after?: {
        day?: string;
        start_time?: string;
        end_time?: string;
        recurrence_rule?: string;
        student_name?: string;
        schedule_id?: string;
    };
}

export interface PlanConflict {
    type: 'overlap' | 'buffer_violation' | 'outside_hours' | 'preference_mismatch';
    description: string;
    severity: 'warning' | 'error';
    affected_entries: string[];
}

export interface SchedulePlan {
    id: string;
    schedule_id: string;
    user_id: string;
    status: 'pending' | 'committed' | 'expired';
    changes: PlanChange[];
    conflicts: PlanConflict[];
    summary: string | null;
    created_at: string;
    expires_at: string;
}

// ============================================
// CRUD
// ============================================

export async function createPlan(
    scheduleId: string,
    changes: PlanChange[],
    conflicts: PlanConflict[],
    summary?: string
): Promise<SchedulePlan> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('schedule_plans')
        .insert({
            schedule_id: scheduleId,
            user_id: user.id,
            changes,
            conflicts,
            summary: summary || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data as SchedulePlan;
}

export async function getPlan(planId: string): Promise<SchedulePlan | null> {
    const { data, error } = await supabase
        .from('schedule_plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data as SchedulePlan;
}

export async function commitPlan(planId: string): Promise<SchedulePlan> {
    const { data, error } = await supabase
        .from('schedule_plans')
        .update({ status: 'committed' })
        .eq('id', planId)
        .eq('status', 'pending')
        .select()
        .single();

    if (error) throw error;
    return data as SchedulePlan;
}

export async function expirePlan(planId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_plans')
        .update({ status: 'expired' })
        .eq('id', planId)
        .eq('status', 'pending');

    if (error) throw error;
}

export async function getPendingPlans(scheduleId: string): Promise<SchedulePlan[]> {
    const { data, error } = await supabase
        .from('schedule_plans')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SchedulePlan[];
}
