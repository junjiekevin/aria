import { supabase } from '../supabase';

export interface SetupCalendar {
  providerCalendarId: string;
  name: string;
  color: string | null;
  timezone: string;
  selectedForSync: boolean;
  isPrimaryWrite: boolean;
}

export interface CalendarSetupStatus {
  provider: 'google';
  account: { id: string; providerAccountId: string };
  calendars: SetupCalendar[];
  setupComplete: boolean;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function getGoogleAuthStartUrl(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/google/start`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to start Google auth');
  const payload = await response.json() as { url: string };
  return payload.url;
}

export async function finalizeGoogleAuth(): Promise<void> {
  const response = await authedFetch('/v1/auth/google/finalize', {
    method: 'POST',
    body: '{}',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to finalize Google auth');
  }
}

export async function fetchCalendarSetupStatus(): Promise<CalendarSetupStatus> {
  const response = await authedFetch('/v1/calendar/setup/status');
  if (!response.ok) throw new Error('Failed to load calendar setup status');
  return response.json() as Promise<CalendarSetupStatus>;
}

export async function saveCalendarSelection(input: {
  calendars: Array<Pick<SetupCalendar, 'providerCalendarId' | 'name' | 'color' | 'timezone' | 'selectedForSync'>>;
  primaryWriteProviderCalendarId: string;
}): Promise<void> {
  const response = await authedFetch('/v1/calendar/setup/selection', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to save calendar selection');
  }
}

export async function runInitialCalendarSync(): Promise<void> {
  const response = await authedFetch('/v1/calendar/sync/run', { method: 'POST', body: '{}' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to run initial sync');
  }
}

export async function registerCalendarWatches(): Promise<void> {
  const response = await authedFetch('/v1/calendar/watch/register', { method: 'POST', body: '{}' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Failed to register calendar watches');
  }
}
