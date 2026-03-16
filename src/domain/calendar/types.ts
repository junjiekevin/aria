export type CalendarProvider = 'google';

export interface CalendarEvent {
  id: string;
  userId: string;
  provider: CalendarProvider;
  providerCalendarId: string;
  providerEventId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  sourceCalendarName: string;
  sourceCalendarColor: string | null;
  syncStatus: 'synced' | 'pending_write' | 'sync_error';
  etag: string | null;
  isDeleted: boolean;
  lastSyncedAt: string | null;
}

export interface CalendarOperationLog {
  id: string;
  userId: string;
  actor: 'user' | 'assistant' | 'system';
  sourceSurface: 'calendar_ui' | 'floating_chat' | 'system_sync';
  actionType: string;
  targetRef: string;
  result: 'success' | 'failure';
  errorPayload: Record<string, unknown> | null;
  providerMetadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface EventWorkflowState {
  id: string;
  calendarEventId: string;
  workflowStatus: string;
  reminderState: string | null;
  followUpState: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
