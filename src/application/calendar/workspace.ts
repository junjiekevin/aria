import type { CalendarEventRepository } from '../../domain/calendar';

export async function listWorkspaceEvents(
  repository: CalendarEventRepository,
  userId: string,
  range?: { from?: string; to?: string },
) {
  const events = await repository.listByUser(userId, { includeDeleted: false });

  if (!range?.from && !range?.to) return events;

  return events.filter((event) => {
    const start = new Date(event.startAt).getTime();
    const end = new Date(event.endAt).getTime();
    const from = range.from ? new Date(range.from).getTime() : Number.NEGATIVE_INFINITY;
    const to = range.to ? new Date(range.to).getTime() : Number.POSITIVE_INFINITY;
    return end >= from && start <= to;
  });
}
