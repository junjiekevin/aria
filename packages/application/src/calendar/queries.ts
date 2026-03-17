import type { CalendarEventRepository } from '@aria/domain';

export async function listCalendarEventsByUser(
  repository: CalendarEventRepository,
  userId: string,
): Promise<Awaited<ReturnType<CalendarEventRepository['listByUser']>>> {
  return repository.listByUser(userId, { includeDeleted: false });
}
