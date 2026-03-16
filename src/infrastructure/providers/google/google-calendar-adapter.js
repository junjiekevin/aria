export class GoogleCalendarAdapter {
    resolveTokens;
    provider = 'google';
    constructor(resolveTokens) {
        this.resolveTokens = resolveTokens;
    }
    async authedFetch(accountId, url, init) {
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
    async listCalendars(accountId) {
        const response = await this.authedFetch(accountId, 'https://www.googleapis.com/calendar/v3/users/me/calendarList');
        const payload = await response.json();
        return (payload.items ?? [])
            .filter((item) => Boolean(item.id))
            .map((item) => ({
            id: item.id,
            calendarAccountId: '',
            provider: 'google',
            providerCalendarId: item.id,
            name: item.summary ?? item.id,
            color: item.backgroundColor ?? null,
            timezone: item.timeZone ?? 'UTC',
            selectedForSync: Boolean(item.primary),
            isPrimaryWrite: Boolean(item.primary),
        }));
    }
    toCanonicalEvent(params) {
        const eventId = params.event.id;
        if (!eventId)
            return null;
        const startAt = params.event.start?.dateTime ?? (params.event.start?.date ? `${params.event.start.date}T00:00:00Z` : null);
        const endAt = params.event.end?.dateTime ?? (params.event.end?.date ? `${params.event.end.date}T23:59:59Z` : null);
        if (!startAt || !endAt)
            return null;
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
    async initialSync(accountId, calendarId) {
        const response = await this.authedFetch(accountId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&showDeleted=true&maxResults=2500`);
        const payload = await response.json();
        const events = (payload.items ?? [])
            .map((event) => this.toCanonicalEvent({
            userId: '',
            providerCalendarId: calendarId,
            sourceCalendarName: calendarId,
            sourceCalendarColor: null,
            event,
        }))
            .filter((event) => Boolean(event));
        return {
            events,
            nextSyncToken: payload.nextSyncToken ?? null,
        };
    }
    async incrementalSync(accountId, calendarId, syncToken) {
        const query = syncToken
            ? `syncToken=${encodeURIComponent(syncToken)}&showDeleted=true`
            : 'singleEvents=true&showDeleted=true';
        const response = await this.authedFetch(accountId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
        const payload = await response.json();
        const events = (payload.items ?? [])
            .map((event) => this.toCanonicalEvent({
            userId: '',
            providerCalendarId: calendarId,
            sourceCalendarName: calendarId,
            sourceCalendarColor: null,
            event,
        }))
            .filter((event) => Boolean(event));
        return {
            events,
            nextSyncToken: payload.nextSyncToken ?? null,
        };
    }
    async createEvent(_accountId, _input) {
        throw new Error('NOT_IMPLEMENTED: provider write path is introduced in BLD-005');
    }
    async updateEvent(_accountId, _providerEventId, _input) {
        throw new Error('NOT_IMPLEMENTED: provider write path is introduced in BLD-005');
    }
    async deleteEvent(_accountId, _calendarId, _providerEventId) {
        throw new Error('NOT_IMPLEMENTED: provider write path is introduced in BLD-005');
    }
    async watchCalendar(accountId, calendarId) {
        const channelId = crypto.randomUUID();
        const address = process.env.GOOGLE_WEBHOOK_URL;
        if (!address) {
            throw new Error('GOOGLE_WEBHOOK_URL is required for watch registration');
        }
        const response = await this.authedFetch(accountId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
            method: 'POST',
            body: JSON.stringify({
                id: channelId,
                type: 'web_hook',
                address,
                token: process.env.GOOGLE_WEBHOOK_TOKEN ?? '',
            }),
        });
        const payload = await response.json();
        return {
            channelId: payload.id ?? channelId,
            resourceId: payload.resourceId ?? '',
            expiresAt: payload.expiration ? new Date(Number(payload.expiration)).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
    }
    async renewWatch(accountId, calendarId, _channelId) {
        const watch = await this.watchCalendar(accountId, calendarId);
        return { expiresAt: watch.expiresAt };
    }
}
