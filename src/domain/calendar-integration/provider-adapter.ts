import type { CalendarEvent } from '../calendar/types';
import type { ProviderCalendar } from './types';

export interface ProviderCalendarEventWriteInput {
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
}

export interface ProviderSyncResult {
  events: CalendarEvent[];
  nextSyncToken: string | null;
}

export interface CalendarProviderAdapter {
  readonly provider: 'google';
  listCalendars(accountId: string): Promise<ProviderCalendar[]>;
  initialSync(accountId: string, calendarId: string): Promise<ProviderSyncResult>;
  incrementalSync(accountId: string, calendarId: string, syncToken: string | null): Promise<ProviderSyncResult>;
  createEvent(accountId: string, input: ProviderCalendarEventWriteInput): Promise<CalendarEvent>;
  updateEvent(accountId: string, providerEventId: string, input: ProviderCalendarEventWriteInput): Promise<CalendarEvent>;
  deleteEvent(accountId: string, calendarId: string, providerEventId: string): Promise<void>;
  watchCalendar(accountId: string, calendarId: string): Promise<{ channelId: string; resourceId: string; expiresAt: string }>;
  renewWatch(accountId: string, calendarId: string, channelId: string): Promise<{ expiresAt: string }>;
}
