import type { EventWorkflowState, EventWorkflowStateRepository } from '../../domain/calendar';
import { supabase } from '../../lib/supabase';

type EventWorkflowStateRow = {
  id: string;
  calendar_event_id: string;
  workflow_status: string;
  reminder_state: string | null;
  follow_up_state: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toDomain(row: EventWorkflowStateRow): EventWorkflowState {
  return {
    id: row.id,
    calendarEventId: row.calendar_event_id,
    workflowStatus: row.workflow_status,
    reminderState: row.reminder_state,
    followUpState: row.follow_up_state,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(state: EventWorkflowState): EventWorkflowStateRow {
  return {
    id: state.id,
    calendar_event_id: state.calendarEventId,
    workflow_status: state.workflowStatus,
    reminder_state: state.reminderState,
    follow_up_state: state.followUpState,
    metadata: state.metadata,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
  };
}

export class SupabaseEventWorkflowStateRepository implements EventWorkflowStateRepository {
  async getByEventId(calendarEventId: string): Promise<EventWorkflowState | null> {
    const { data, error } = await supabase
      .from('event_workflow_state')
      .select('*')
      .eq('calendar_event_id', calendarEventId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch workflow state: ${error.message}`);
    return data ? toDomain(data as EventWorkflowStateRow) : null;
  }

  async upsert(state: EventWorkflowState): Promise<EventWorkflowState> {
    const { data, error } = await supabase
      .from('event_workflow_state')
      .upsert(toRow(state), { onConflict: 'calendar_event_id' })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to upsert workflow state: ${error.message}`);
    return toDomain(data as EventWorkflowStateRow);
  }
}
