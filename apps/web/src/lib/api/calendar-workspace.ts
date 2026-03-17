import { supabase } from '../supabase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export interface WorkspaceCalendar {
  providerCalendarId: string;
  name: string;
  color: string | null;
  timezone: string;
  selectedForSync: boolean;
  isPrimaryWrite: boolean;
}

export interface WorkspaceEvent {
  id: string;
  providerCalendarId: string;
  providerEventId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  sourceCalendarName: string;
  sourceCalendarColor: string | null;
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

async function authedFetch(path: string, init?: RequestInit, sourceSurface: 'calendar_ui' | 'floating_chat' = 'calendar_ui'): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Aria-Source-Surface': sourceSurface,
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchWorkspaceEvents(params?: { from?: string; to?: string }): Promise<{ calendars: WorkspaceCalendar[]; events: WorkspaceEvent[] }> {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  const suffix = search.toString() ? `?${search.toString()}` : '';

  const response = await authedFetch(`/v1/calendar/events${suffix}`);
  if (!response.ok) throw new Error('Failed to fetch calendar workspace events');
  return response.json() as Promise<{ calendars: WorkspaceCalendar[]; events: WorkspaceEvent[] }>;
}

export async function createWorkspaceEvent(input: {
  providerCalendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
}, sourceSurface: 'calendar_ui' | 'floating_chat' = 'calendar_ui'): Promise<void> {
  const response = await authedFetch('/v1/calendar/events', {
    method: 'POST',
    body: JSON.stringify(input),
  }, sourceSurface);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to create event');
  }
}

export async function updateWorkspaceEvent(eventId: string, input: Partial<{
  providerCalendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
}>, sourceSurface: 'calendar_ui' | 'floating_chat' = 'calendar_ui'): Promise<void> {
  const response = await authedFetch(`/v1/calendar/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, sourceSurface);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to update event');
  }
}

export async function deleteWorkspaceEvent(eventId: string, sourceSurface: 'calendar_ui' | 'floating_chat' = 'calendar_ui'): Promise<void> {
  const response = await authedFetch(`/v1/calendar/events/${eventId}`, { method: 'DELETE' }, sourceSurface);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to delete event');
  }
}
