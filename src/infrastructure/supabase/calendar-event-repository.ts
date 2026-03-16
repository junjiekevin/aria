import type { CalendarEvent, CalendarEventRepository } from '../../domain/calendar';
import { supabase } from '../../lib/supabase';

type CalendarEventRow = {
  id: string;
  user_id: string;
  provider: 'google';
  provider_calendar_id: string;
  provider_event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  source_calendar_name: string;
  source_calendar_color: string | null;
  sync_status: 'synced' | 'pending_write' | 'sync_error';
  etag: string | null;
  is_deleted: boolean;
  last_synced_at: string | null;
};

function toDomain(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerCalendarId: row.provider_calendar_id,
    providerEventId: row.provider_event_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    sourceCalendarName: row.source_calendar_name,
    sourceCalendarColor: row.source_calendar_color,
    syncStatus: row.sync_status,
    etag: row.etag,
    isDeleted: row.is_deleted,
    lastSyncedAt: row.last_synced_at,
  };
}

function toRow(event: CalendarEvent): CalendarEventRow {
  return {
    id: event.id,
    user_id: event.userId,
    provider: event.provider,
    provider_calendar_id: event.providerCalendarId,
    provider_event_id: event.providerEventId,
    title: event.title,
    start_at: event.startAt,
    end_at: event.endAt,
    timezone: event.timezone,
    source_calendar_name: event.sourceCalendarName,
    source_calendar_color: event.sourceCalendarColor,
    sync_status: event.syncStatus,
    etag: event.etag,
    is_deleted: event.isDeleted,
    last_synced_at: event.lastSyncedAt,
  };
}

export class SupabaseCalendarEventRepository implements CalendarEventRepository {
  async listByUser(userId: string, options?: { includeDeleted?: boolean }): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_at', { ascending: true });

    if (!options?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list calendar events: ${error.message}`);
    return (data ?? []).map((row) => toDomain(row as CalendarEventRow));
  }

  async getByProviderRef(userId: string, providerCalendarId: string, providerEventId: string): Promise<CalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('provider_calendar_id', providerCalendarId)
      .eq('provider_event_id', providerEventId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch calendar event by provider ref: ${error.message}`);
    return data ? toDomain(data as CalendarEventRow) : null;
  }

  async upsert(events: CalendarEvent[]): Promise<void> {
    if (events.length === 0) return;
    const { error } = await supabase
      .from('calendar_events')
      .upsert(events.map(toRow), {
        onConflict: 'provider,provider_calendar_id,provider_event_id',
      });

    if (error) throw new Error(`Failed to upsert calendar events: ${error.message}`);
  }
}
