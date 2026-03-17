// src/lib/api/calendar-chat.ts
// Active canonical bridge for assistant-triggered calendar event operations (BLD-012).
// Translates legacy-style chat tool args into canonical calendar-workspace calls.
// All operations route through calendar-workspace.ts → apps/api (server-managed path).
// This file has no dependency on legacy schedule CRUD seams.

import {
  createWorkspaceEvent,
  deleteWorkspaceEvent,
  fetchWorkspaceEvents,
  type WorkspaceEvent,
  updateWorkspaceEvent,
} from './calendar-workspace';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

type LegacyAddArgs = {
  student_name: string;
  day?: string;
  hour?: number;
  start_time?: string;
  end_time?: string;
};

type LegacyUpdateArgs = {
  event_id: string;
  student_name?: string;
  day?: string;
  hour?: number;
  start_time?: string;
  end_time?: string;
};

function toNearestFutureDate(dayName?: string): Date {
  const now = new Date();
  if (!dayName) return now;

  const target = DAY_NAMES.findIndex((day) => day.toLowerCase() === dayName.toLowerCase());
  if (target < 0) return now;

  const date = new Date(now);
  const delta = (target - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function computeStartEnd(args: { day?: string; hour?: number; start_time?: string; end_time?: string }): { startAt: string; endAt: string } {
  const base = toNearestFutureDate(args.day);

  if (args.start_time && args.end_time) {
    const [sh, sm = '00'] = args.start_time.split(':');
    const [eh, em = '00'] = args.end_time.split(':');
    const start = new Date(base);
    start.setHours(Number(sh), Number(sm), 0, 0);
    const end = new Date(base);
    end.setHours(Number(eh), Number(em), 0, 0);
    if (end <= start) end.setHours(start.getHours() + 1);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  const hour = typeof args.hour === 'number' ? Math.max(0, Math.min(23, Math.trunc(args.hour))) : 9;
  const start = new Date(base);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function mapCompactEvent(event: WorkspaceEvent): { i: string; n: string; t: string; r: string } {
  const date = new Date(event.startAt);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return {
    i: event.id,
    n: event.title || 'Untitled',
    t: `${hh}:${mm}`,
    r: '',
  };
}

export async function createCalendarEventFromLegacyArgs(args: LegacyAddArgs) {
  const workspace = await fetchWorkspaceEvents();
  const primary = workspace.calendars.find((calendar) => calendar.isPrimaryWrite)
    ?? workspace.calendars.find((calendar) => calendar.selectedForSync);

  if (!primary) throw new Error('No write calendar selected. Complete /calendar/setup first.');

  const { startAt, endAt } = computeStartEnd(args);

  await createWorkspaceEvent({
    providerCalendarId: primary.providerCalendarId,
    title: args.student_name,
    startAt,
    endAt,
    timezone: primary.timezone || 'UTC',
  }, 'floating_chat');

  const refreshed = await fetchWorkspaceEvents();
  const match = [...refreshed.events]
    .reverse()
    .find((event) => event.title === args.student_name && event.providerCalendarId === primary.providerCalendarId);

  return match ?? null;
}

export async function updateCalendarEventFromLegacyArgs(args: LegacyUpdateArgs) {
  const workspace = await fetchWorkspaceEvents();
  const existing = workspace.events.find((event) => event.id === args.event_id);
  if (!existing) throw new Error('Event not found');

  const { startAt, endAt } = computeStartEnd({
    day: args.day,
    hour: args.hour,
    start_time: args.start_time,
    end_time: args.end_time,
  });

  await updateWorkspaceEvent(existing.id, {
    providerCalendarId: existing.providerCalendarId,
    title: args.student_name ?? existing.title,
    startAt: args.day || args.hour !== undefined || args.start_time ? startAt : existing.startAt,
    endAt: args.day || args.hour !== undefined || args.end_time ? endAt : existing.endAt,
    timezone: existing.timezone || 'UTC',
  }, 'floating_chat');

  const refreshed = await fetchWorkspaceEvents();
  return refreshed.events.find((event) => event.id === existing.id) ?? null;
}

export async function deleteCalendarEventById(eventId: string): Promise<void> {
  await deleteWorkspaceEvent(eventId, 'floating_chat');
}

export async function swapCalendarEventsById(event1Id: string, event2Id: string): Promise<[WorkspaceEvent, WorkspaceEvent]> {
  const workspace = await fetchWorkspaceEvents();
  const first = workspace.events.find((event) => event.id === event1Id);
  const second = workspace.events.find((event) => event.id === event2Id);

  if (!first || !second) {
    throw new Error('One or both events were not found');
  }
  if (first.providerCalendarId !== second.providerCalendarId) {
    throw new Error('Cross-calendar swap is not supported');
  }

  await updateWorkspaceEvent(first.id, {
    providerCalendarId: first.providerCalendarId,
    startAt: second.startAt,
    endAt: second.endAt,
    timezone: second.timezone || first.timezone || 'UTC',
  }, 'floating_chat');
  try {
    await updateWorkspaceEvent(second.id, {
      providerCalendarId: second.providerCalendarId,
      startAt: first.startAt,
      endAt: first.endAt,
      timezone: first.timezone || second.timezone || 'UTC',
    }, 'floating_chat');
  } catch (swapError) {
    try {
      await updateWorkspaceEvent(first.id, {
        providerCalendarId: first.providerCalendarId,
        startAt: first.startAt,
        endAt: first.endAt,
        timezone: first.timezone || second.timezone || 'UTC',
      }, 'floating_chat');
    } catch (rollbackError) {
      const swapMessage = swapError instanceof Error ? swapError.message : String(swapError);
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`Swap failed and rollback failed: ${swapMessage}; rollback error: ${rollbackMessage}`);
    }

    const swapMessage = swapError instanceof Error ? swapError.message : String(swapError);
    throw new Error(`Swap failed; first event was rolled back: ${swapMessage}`);
  }

  const refreshed = await fetchWorkspaceEvents();
  const updatedFirst = refreshed.events.find((event) => event.id === first.id);
  const updatedSecond = refreshed.events.find((event) => event.id === second.id);
  if (!updatedFirst || !updatedSecond) {
    throw new Error('Swap completed but could not refresh updated events');
  }

  return [updatedFirst, updatedSecond];
}

export async function getCalendarEventSummary(): Promise<Record<string, Array<{ i: string; n: string; t: string; r: string }>>> {
  const workspace = await fetchWorkspaceEvents();
  const summary: Record<string, Array<{ i: string; n: string; t: string; r: string }>> = {
    Sunday: [], Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [],
  };

  for (const event of workspace.events) {
    const day = DAY_NAMES[new Date(event.startAt).getDay()];
    summary[day].push(mapCompactEvent(event));
  }

  return summary;
}

export async function searchCalendarEvents(query: string): Promise<Array<{ i: string; n: string; t: string; r: string }>> {
  const workspace = await fetchWorkspaceEvents();
  const q = query.trim().toLowerCase();
  return workspace.events
    .filter((event) => event.title.toLowerCase().includes(q))
    .map(mapCompactEvent);
}
