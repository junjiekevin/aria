import type { CalendarAccount, ProviderCalendar, CalendarSyncCursor } from './types.js';

export interface CalendarAccountRepository {
  getByUserAndProvider(userId: string, provider: 'google'): Promise<CalendarAccount | null>;
  upsert(account: CalendarAccount): Promise<CalendarAccount>;
}

export interface ProviderCalendarRepository {
  listByAccount(calendarAccountId: string): Promise<ProviderCalendar[]>;
  replaceSelection(calendarAccountId: string, calendars: ProviderCalendar[]): Promise<void>;
}

export interface CalendarSyncCursorRepository {
  getByProviderCalendarId(providerCalendarId: string): Promise<CalendarSyncCursor | null>;
  upsert(cursor: CalendarSyncCursor): Promise<void>;
}
