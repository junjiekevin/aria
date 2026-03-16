import type {
  CalendarAccount,
  CalendarAccountRepository,
  ProviderCalendar,
  ProviderCalendarRepository,
  CalendarSyncCursor,
  CalendarSyncCursorRepository,
} from '../../domain/calendar-integration';
import { supabase } from '../../lib/supabase';

type CalendarAccountRow = {
  id: string;
  user_id: string;
  provider: 'google';
  provider_account_id: string;
  encrypted_token_metadata: string | null;
  scope_metadata: string[] | null;
  connection_status: 'connected' | 'revoked' | 'error';
  created_at: string;
  updated_at: string;
};

type ProviderCalendarRow = {
  id: string;
  calendar_account_id: string;
  provider: 'google';
  provider_calendar_id: string;
  name: string;
  color: string | null;
  timezone: string;
  selected_for_sync: boolean;
  is_primary_write: boolean;
};

type CalendarSyncCursorRow = {
  id: string;
  provider_calendar_id: string;
  sync_token: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expires_at: string | null;
  last_successful_sync_at: string | null;
};

function toCalendarAccount(row: CalendarAccountRow): CalendarAccount {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    encryptedTokenMetadata: row.encrypted_token_metadata,
    scopeMetadata: row.scope_metadata,
    connectionStatus: row.connection_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCalendarAccountRow(account: CalendarAccount): CalendarAccountRow {
  return {
    id: account.id,
    user_id: account.userId,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    encrypted_token_metadata: account.encryptedTokenMetadata,
    scope_metadata: account.scopeMetadata,
    connection_status: account.connectionStatus,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

function toProviderCalendar(row: ProviderCalendarRow): ProviderCalendar {
  return {
    id: row.id,
    calendarAccountId: row.calendar_account_id,
    provider: row.provider,
    providerCalendarId: row.provider_calendar_id,
    name: row.name,
    color: row.color,
    timezone: row.timezone,
    selectedForSync: row.selected_for_sync,
    isPrimaryWrite: row.is_primary_write,
  };
}

function toProviderCalendarRow(calendar: ProviderCalendar): ProviderCalendarRow {
  return {
    id: calendar.id,
    calendar_account_id: calendar.calendarAccountId,
    provider: calendar.provider,
    provider_calendar_id: calendar.providerCalendarId,
    name: calendar.name,
    color: calendar.color,
    timezone: calendar.timezone,
    selected_for_sync: calendar.selectedForSync,
    is_primary_write: calendar.isPrimaryWrite,
  };
}

function toCalendarSyncCursor(row: CalendarSyncCursorRow): CalendarSyncCursor {
  return {
    id: row.id,
    providerCalendarId: row.provider_calendar_id,
    syncToken: row.sync_token,
    watchChannelId: row.watch_channel_id,
    watchResourceId: row.watch_resource_id,
    watchExpiresAt: row.watch_expires_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
  };
}

function toCalendarSyncCursorRow(cursor: CalendarSyncCursor): CalendarSyncCursorRow {
  return {
    id: cursor.id,
    provider_calendar_id: cursor.providerCalendarId,
    sync_token: cursor.syncToken,
    watch_channel_id: cursor.watchChannelId,
    watch_resource_id: cursor.watchResourceId,
    watch_expires_at: cursor.watchExpiresAt,
    last_successful_sync_at: cursor.lastSuccessfulSyncAt,
  };
}

export class SupabaseCalendarAccountRepository implements CalendarAccountRepository {
  async getByUserAndProvider(userId: string, provider: 'google'): Promise<CalendarAccount | null> {
    const { data, error } = await supabase
      .from('calendar_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch calendar account: ${error.message}`);
    return data ? toCalendarAccount(data as CalendarAccountRow) : null;
  }

  async upsert(account: CalendarAccount): Promise<CalendarAccount> {
    const { data, error } = await supabase
      .from('calendar_accounts')
      .upsert(toCalendarAccountRow(account), { onConflict: 'provider,provider_account_id' })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to upsert calendar account: ${error.message}`);
    return toCalendarAccount(data as CalendarAccountRow);
  }
}

export class SupabaseProviderCalendarRepository implements ProviderCalendarRepository {
  async listByAccount(calendarAccountId: string): Promise<ProviderCalendar[]> {
    const { data, error } = await supabase
      .from('provider_calendars')
      .select('*')
      .eq('calendar_account_id', calendarAccountId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to list provider calendars: ${error.message}`);
    return (data ?? []).map((row) => toProviderCalendar(row as ProviderCalendarRow));
  }

  async replaceSelection(calendarAccountId: string, calendars: ProviderCalendar[]): Promise<void> {
    const payload = calendars.map((calendar) =>
      toProviderCalendarRow({ ...calendar, calendarAccountId }),
    );

    const { error: upsertError } = await supabase
      .from('provider_calendars')
      .upsert(payload, { onConflict: 'provider,provider_calendar_id' });

    if (upsertError) {
      throw new Error(`Failed to replace provider calendar selection: ${upsertError.message}`);
    }
  }
}

export class SupabaseCalendarSyncCursorRepository implements CalendarSyncCursorRepository {
  async getByProviderCalendarId(providerCalendarId: string): Promise<CalendarSyncCursor | null> {
    const { data, error } = await supabase
      .from('calendar_sync_cursors')
      .select('*')
      .eq('provider_calendar_id', providerCalendarId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch sync cursor: ${error.message}`);
    return data ? toCalendarSyncCursor(data as CalendarSyncCursorRow) : null;
  }

  async upsert(cursor: CalendarSyncCursor): Promise<void> {
    const { error } = await supabase
      .from('calendar_sync_cursors')
      .upsert(toCalendarSyncCursorRow(cursor), { onConflict: 'provider_calendar_id' });

    if (error) throw new Error(`Failed to upsert sync cursor: ${error.message}`);
  }
}
