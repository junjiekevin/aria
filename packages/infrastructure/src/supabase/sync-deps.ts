import type { CalendarEvent, CalendarProviderAdapter } from '@aria/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseCalendarSyncDeps(db: SupabaseClient, adapter: CalendarProviderAdapter) {
  return {
    accounts: {
      async getByUserAndProvider(userId: string, provider: 'google') {
        const { data, error } = await db
          .from('calendar_accounts')
          .select('id,user_id,provider,provider_account_id,scope_metadata,connection_status,created_at,updated_at')
          .eq('user_id', userId)
          .eq('provider', provider)
          .maybeSingle();
        if (error || !data) return null;
        return {
          id: data.id,
          userId: data.user_id,
          provider: data.provider,
          providerAccountId: data.provider_account_id,
          encryptedTokenMetadata: null,
          scopeMetadata: data.scope_metadata,
          connectionStatus: data.connection_status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      },
      async upsert() {
        throw new Error('NOT_REQUIRED_IN_SYNC_DEP');
      },
    },
    providerCalendars: {
      async listByAccount(calendarAccountId: string) {
        const { data, error } = await db
          .from('provider_calendars')
          .select('*')
          .eq('calendar_account_id', calendarAccountId)
          .order('name', { ascending: true });
        if (error) throw new Error(error.message);
        return (data ?? []).map((row) => ({
          id: row.id,
          calendarAccountId: row.calendar_account_id,
          provider: row.provider,
          providerCalendarId: row.provider_calendar_id,
          name: row.name,
          color: row.color,
          timezone: row.timezone,
          selectedForSync: row.selected_for_sync,
          isPrimaryWrite: row.is_primary_write,
        }));
      },
      async replaceSelection() {
        throw new Error('NOT_REQUIRED_IN_SYNC_DEP');
      },
    },
    cursors: {
      async getByProviderCalendarId(providerCalendarId: string) {
        const { data, error } = await db
          .from('calendar_sync_cursors')
          .select('*')
          .eq('provider_calendar_id', providerCalendarId)
          .maybeSingle();
        if (error || !data) return null;
        return {
          id: data.id,
          providerCalendarId: data.provider_calendar_id,
          syncToken: data.sync_token,
          watchChannelId: data.watch_channel_id,
          watchResourceId: data.watch_resource_id,
          watchExpiresAt: data.watch_expires_at,
          lastSuccessfulSyncAt: data.last_successful_sync_at,
        };
      },
      async upsert(cursor: {
        id: string;
        providerCalendarId: string;
        syncToken: string | null;
        watchChannelId: string | null;
        watchResourceId: string | null;
        watchExpiresAt: string | null;
        lastSuccessfulSyncAt: string | null;
      }) {
        const { error } = await db.from('calendar_sync_cursors').upsert({
          id: cursor.id,
          provider_calendar_id: cursor.providerCalendarId,
          sync_token: cursor.syncToken,
          watch_channel_id: cursor.watchChannelId,
          watch_resource_id: cursor.watchResourceId,
          watch_expires_at: cursor.watchExpiresAt,
          last_successful_sync_at: cursor.lastSuccessfulSyncAt,
        }, { onConflict: 'provider_calendar_id' });

        if (error) throw new Error(error.message);
      },
    },
    events: {
      async listByUser() { return []; },
      async getByProviderRef() { return null; },
      async upsert(events: CalendarEvent[]) {
        if (events.length === 0) return;
        const rows = events.map((event) => ({
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
        }));

        const { error } = await db
          .from('calendar_events')
          .upsert(rows, { onConflict: 'provider,provider_calendar_id,provider_event_id' });
        if (error) throw new Error(error.message);
      },
    },
    operations: {
      async append(entry: {
        userId: string;
        actor: 'user' | 'assistant' | 'system';
        sourceSurface: 'calendar_ui' | 'floating_chat' | 'system_sync';
        actionType: string;
        targetRef: string;
        result: 'success' | 'failure';
        errorPayload: Record<string, unknown> | null;
        providerMetadata: Record<string, unknown> | null;
      }) {
        const { error } = await db.from('calendar_operation_log').insert({
          user_id: entry.userId,
          actor: entry.actor,
          source_surface: entry.sourceSurface,
          action_type: entry.actionType,
          target_ref: entry.targetRef,
          result: entry.result,
          error_payload: entry.errorPayload,
          provider_metadata: entry.providerMetadata,
        });
        if (error) throw new Error(error.message);
      },
    },
    adapter,
  };
}
