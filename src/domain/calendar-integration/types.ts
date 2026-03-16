import type { CalendarProvider } from '../calendar/types';

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: CalendarProvider;
  providerAccountId: string;
  encryptedTokenMetadata: string | null;
  scopeMetadata: string[] | null;
  connectionStatus: 'connected' | 'revoked' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCalendar {
  id: string;
  calendarAccountId: string;
  provider: CalendarProvider;
  providerCalendarId: string;
  name: string;
  color: string | null;
  timezone: string;
  selectedForSync: boolean;
  isPrimaryWrite: boolean;
}

export interface CalendarSyncCursor {
  id: string;
  providerCalendarId: string;
  syncToken: string | null;
  watchChannelId: string | null;
  watchResourceId: string | null;
  watchExpiresAt: string | null;
  lastSuccessfulSyncAt: string | null;
}
