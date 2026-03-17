import type { CalendarEvent } from '@aria/domain';

export interface CreateCalendarEventCommand {
  userId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
}

export interface CalendarCommandHandlers {
  createEvent(command: CreateCalendarEventCommand): Promise<CalendarEvent>;
}
