import type { CalendarEvent, CalendarOperationLog, EventWorkflowState } from './types.js';

export interface CalendarEventRepository {
  listByUser(userId: string, options?: { includeDeleted?: boolean }): Promise<CalendarEvent[]>;
  getByProviderRef(userId: string, providerCalendarId: string, providerEventId: string): Promise<CalendarEvent | null>;
  upsert(events: CalendarEvent[]): Promise<void>;
}

export interface CalendarOperationLogRepository {
  append(entry: Omit<CalendarOperationLog, 'id' | 'createdAt'>): Promise<void>;
}

export interface EventWorkflowStateRepository {
  getByEventId(calendarEventId: string): Promise<EventWorkflowState | null>;
  upsert(state: EventWorkflowState): Promise<EventWorkflowState>;
}
