export async function syncSelectedCalendarsForUser(deps, input) {
    const account = await deps.accounts.getByUserAndProvider(input.userId, 'google');
    if (!account)
        return { syncedCalendars: 0, syncedEvents: 0 };
    const calendars = await deps.providerCalendars.listByAccount(account.id);
    const selected = calendars.filter((calendar) => calendar.selectedForSync);
    let syncedEvents = 0;
    for (const calendar of selected) {
        const cursor = await deps.cursors.getByProviderCalendarId(calendar.id);
        const syncResult = cursor?.syncToken
            ? await deps.adapter.incrementalSync(account.providerAccountId, calendar.providerCalendarId, cursor.syncToken)
            : await deps.adapter.initialSync(account.providerAccountId, calendar.providerCalendarId);
        const canonical = syncResult.events.map((event) => ({
            ...event,
            id: event.id || crypto.randomUUID(),
            userId: input.userId,
            providerCalendarId: calendar.providerCalendarId,
            sourceCalendarName: calendar.name,
            sourceCalendarColor: calendar.color,
            lastSyncedAt: new Date().toISOString(),
        }));
        await deps.events.upsert(canonical);
        syncedEvents += canonical.length;
        await deps.cursors.upsert({
            id: cursor?.id ?? crypto.randomUUID(),
            providerCalendarId: calendar.id,
            syncToken: syncResult.nextSyncToken,
            watchChannelId: cursor?.watchChannelId ?? null,
            watchResourceId: cursor?.watchResourceId ?? null,
            watchExpiresAt: cursor?.watchExpiresAt ?? null,
            lastSuccessfulSyncAt: new Date().toISOString(),
        });
        await deps.operations.append({
            userId: input.userId,
            actor: 'system',
            sourceSurface: input.sourceSurface,
            actionType: 'calendar_sync',
            targetRef: calendar.providerCalendarId,
            result: 'success',
            errorPayload: null,
            providerMetadata: {
                provider: 'google',
                nextSyncToken: syncResult.nextSyncToken,
                importedCount: canonical.length,
            },
        });
    }
    return {
        syncedCalendars: selected.length,
        syncedEvents,
    };
}
export async function registerGoogleWatchForSelectedCalendars(deps, input) {
    const account = await deps.accounts.getByUserAndProvider(input.userId, 'google');
    if (!account)
        return { watchedCalendars: 0 };
    const calendars = await deps.providerCalendars.listByAccount(account.id);
    const selected = calendars.filter((calendar) => calendar.selectedForSync);
    for (const calendar of selected) {
        const cursor = await deps.cursors.getByProviderCalendarId(calendar.id);
        const watch = await deps.adapter.watchCalendar(account.providerAccountId, calendar.providerCalendarId);
        await deps.cursors.upsert({
            id: cursor?.id ?? crypto.randomUUID(),
            providerCalendarId: calendar.id,
            syncToken: cursor?.syncToken ?? null,
            watchChannelId: watch.channelId,
            watchResourceId: watch.resourceId,
            watchExpiresAt: watch.expiresAt,
            lastSuccessfulSyncAt: cursor?.lastSuccessfulSyncAt ?? null,
        });
    }
    return { watchedCalendars: selected.length };
}
