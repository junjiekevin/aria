import type { CalendarEventRepository } from '../../domain/calendar';

export async function listCalendarEventsByUser(
  repository: CalendarEventRepository,
  userId: string,
): Promise<Awaited<ReturnType<CalendarEventRepository['listByUser']>>> {
  return repository.listByUser(userId, { includeDeleted: false });
}
