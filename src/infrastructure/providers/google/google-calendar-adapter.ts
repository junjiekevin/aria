import type {
  CalendarProviderAdapter,
  ProviderCalendar,
  ProviderCalendarEventWriteInput,
  ProviderSyncResult,
} from '../../../domain/calendar-integration';
import type { CalendarEvent } from '../../../domain/calendar';

type GoogleTokenBundle = {
  accessToken: string;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    backgroundColor?: string;
    timeZone?: string;
    primary?: boolean;
  }>;
};

type GoogleEventListResponse = {
  nextSyncToken?: string;
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    status?: string;
    etag?: string;
  }>;
};

type GoogleChannelResponse = {
  id?: string;
  resourceId?: string;
  expiration?: string;
};

type GoogleEventResponse = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  etag?: string;
};

export class GoogleCalendarAdapter implements CalendarProviderAdapter {
  readonly provider = 'google' as const;
  private readonly resolveTokens: (accountId: string) => Promise<GoogleTokenBundle>;
  private readonly webhookConfig?: { webhookUrl: string; webhookToken?: string };

  constructor(
    resolveTokens: (accountId: string) => Promise<GoogleTokenBundle>,
    webhookConfig?: { webhookUrl: string; webhookToken?: string },
  ) {
    this.resolveTokens = resolveTokens;
    this.webhookConfig = webhookConfig;
  }

  private async authedFetch(accountId: string, url: string, init?: RequestInit): Promise<Response> {
    const tokens = await this.resolveTokens(accountId);
    if (!tokens.accessToken) {
      throw new Error('GOOGLE_TOKEN_MISSING');
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google API request failed (${response.status}): ${body}`);
    }

    return response;
  }

  async listCalendars(accountId: string): Promise<ProviderCalendar[]> {
    const response = await this.authedFetch(
      accountId,
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    );
    const payload = await response.json() as GoogleCalendarListResponse;

    return (payload.items ?? [])
      .filter((item) => Boolean(item.id))
      .map((item) => ({
        id: item.id!,
        calendarAccountId: '',
        provider: 'google',
        providerCalendarId: item.id!,
        name: item.summary ?? item.id!,
        color: item.backgroundColor ?? null,
        timezone: item.timeZone ?? 'UTC',
        selectedForSync: Boolean(item.primary),
        isPrimaryWrite: Boolean(item.primary),
      }));
  }

  private toCanonicalEvent(params: {
    userId: string;
    providerCalendarId: string;
    sourceCalendarName: string;
    sourceCalendarColor: string | null;
    event: NonNullable<GoogleEventListResponse['items']>[number];
  }): CalendarEvent | null {
    const eventId = params.event.id;
    if (!eventId) return null;

    const startAt = params.event.start?.dateTime ?? (params.event.start?.date ? `${params.event.start.date}T00:00:00Z` : null);
    const endAt = params.event.end?.dateTime ?? (params.event.end?.date ? `${params.event.end.date}T23:59:59Z` : null);
    if (!startAt || !endAt) return null;

    return {
      id: eventId,
      userId: params.userId,
      provider: 'google',
      providerCalendarId: params.providerCalendarId,
      providerEventId: eventId,
      title: params.event.summary ?? '',
      startAt,
      endAt,
      timezone: params.event.start?.timeZone ?? params.event.end?.timeZone ?? 'UTC',
      sourceCalendarName: params.sourceCalendarName,
      sourceCalendarColor: params.sourceCalendarColor,
      syncStatus: 'synced',
      etag: params.event.etag ?? null,
      isDeleted: params.event.status === 'cancelled',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  private toCanonicalFromGoogleEvent(params: {
    providerCalendarId: string;
    sourceCalendarName: string;
    sourceCalendarColor: string | null;
    event: GoogleEventResponse;
  }): CalendarEvent {
    const startAt = params.event.start?.dateTime ?? `${params.event.start?.date ?? ''}T00:00:00Z`;
    const endAt = params.event.end?.dateTime ?? `${params.event.end?.date ?? ''}T23:59:59Z`;
    return {
      id: params.event.id ?? crypto.randomUUID(),
      userId: '',
      provider: 'google',
      providerCalendarId: params.providerCalendarId,
      providerEventId: params.event.id ?? crypto.randomUUID(),
      title: params.event.summary ?? '',
      startAt,
      endAt,
      timezone: params.event.start?.timeZone ?? params.event.end?.timeZone ?? 'UTC',
      sourceCalendarName: params.sourceCalendarName,
      sourceCalendarColor: params.sourceCalendarColor,
      syncStatus: 'synced',
      etag: params.event.etag ?? null,
      isDeleted: params.event.status === 'cancelled',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async initialSync(accountId: string, calendarId: string): Promise<ProviderSyncResult> {
    const response = await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&showDeleted=true&maxResults=2500`,
    );
    const payload = await response.json() as GoogleEventListResponse;
    const events = (payload.items ?? [])
      .map((event) => this.toCanonicalEvent({
        userId: '',
        providerCalendarId: calendarId,
        sourceCalendarName: calendarId,
        sourceCalendarColor: null,
        event,
      }))
      .filter((event): event is CalendarEvent => Boolean(event));

    return {
      events,
      nextSyncToken: payload.nextSyncToken ?? null,
    };
  }

  async incrementalSync(accountId: string, calendarId: string, syncToken: string | null): Promise<ProviderSyncResult> {
    const query = syncToken
      ? `syncToken=${encodeURIComponent(syncToken)}&showDeleted=true`
      : 'singleEvents=true&showDeleted=true';

    const response = await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    );

    const payload = await response.json() as GoogleEventListResponse;
    const events = (payload.items ?? [])
      .map((event) => this.toCanonicalEvent({
        userId: '',
        providerCalendarId: calendarId,
        sourceCalendarName: calendarId,
        sourceCalendarColor: null,
        event,
      }))
      .filter((event): event is CalendarEvent => Boolean(event));

    return {
      events,
      nextSyncToken: payload.nextSyncToken ?? null,
    };
  }

  async createEvent(accountId: string, input: ProviderCalendarEventWriteInput): Promise<CalendarEvent> {
    const response = await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify({
          summary: input.title,
          start: { dateTime: input.startAt, timeZone: input.timezone },
          end: { dateTime: input.endAt, timeZone: input.timezone },
        }),
      },
    );
    const payload = await response.json() as GoogleEventResponse;
    return this.toCanonicalFromGoogleEvent({
      providerCalendarId: input.calendarId,
      sourceCalendarName: input.calendarId,
      sourceCalendarColor: null,
      event: payload,
    });
  }

  async updateEvent(accountId: string, providerEventId: string, input: ProviderCalendarEventWriteInput): Promise<CalendarEvent> {
    const response = await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(providerEventId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          summary: input.title,
          start: { dateTime: input.startAt, timeZone: input.timezone },
          end: { dateTime: input.endAt, timeZone: input.timezone },
        }),
      },
    );
    const payload = await response.json() as GoogleEventResponse;
    return this.toCanonicalFromGoogleEvent({
      providerCalendarId: input.calendarId,
      sourceCalendarName: input.calendarId,
      sourceCalendarColor: null,
      event: payload,
    });
  }

  async deleteEvent(accountId: string, calendarId: string, providerEventId: string): Promise<void> {
    await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(providerEventId)}`,
      { method: 'DELETE' },
    );
  }

  async watchCalendar(accountId: string, calendarId: string): Promise<{ channelId: string; resourceId: string; expiresAt: string }> {
    const channelId = crypto.randomUUID();
    const address = this.webhookConfig?.webhookUrl;
    if (!address) {
      throw new Error('GOOGLE_WEBHOOK_URL is required for watch registration');
    }

    const response = await this.authedFetch(
      accountId,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: 'POST',
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address,
          token: this.webhookConfig?.webhookToken ?? '',
        }),
      },
    );
    const payload = await response.json() as GoogleChannelResponse;
    return {
      channelId: payload.id ?? channelId,
      resourceId: payload.resourceId ?? '',
      expiresAt: payload.expiration ? new Date(Number(payload.expiration)).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async renewWatch(accountId: string, calendarId: string, _channelId: string): Promise<{ expiresAt: string }> {
    const watch = await this.watchCalendar(accountId, calendarId);
    return { expiresAt: watch.expiresAt };
  }
}
