import type { CalendarOperationLogRepository } from '../../domain/calendar';
import { supabase } from '../../lib/supabase';

type CalendarOperationLogInsert = {
  user_id: string;
  actor: 'user' | 'assistant' | 'system';
  source_surface: 'calendar_ui' | 'floating_chat' | 'system_sync';
  action_type: string;
  target_ref: string;
  result: 'success' | 'failure';
  error_payload: Record<string, unknown> | null;
  provider_metadata: Record<string, unknown> | null;
};

export class SupabaseCalendarOperationLogRepository implements CalendarOperationLogRepository {
  async append(entry: {
    userId: string;
    actor: 'user' | 'assistant' | 'system';
    sourceSurface: 'calendar_ui' | 'floating_chat' | 'system_sync';
    actionType: string;
    targetRef: string;
    result: 'success' | 'failure';
    errorPayload: Record<string, unknown> | null;
    providerMetadata: Record<string, unknown> | null;
  }): Promise<void> {
    const payload: CalendarOperationLogInsert = {
      user_id: entry.userId,
      actor: entry.actor,
      source_surface: entry.sourceSurface,
      action_type: entry.actionType,
      target_ref: entry.targetRef,
      result: entry.result,
      error_payload: entry.errorPayload,
      provider_metadata: entry.providerMetadata,
    };

    const { error } = await supabase.from('calendar_operation_log').insert(payload);
    if (error) throw new Error(`Failed to append calendar operation log: ${error.message}`);
  }
}
