import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { createGoogleCalendarAdapterForUser, createSupabaseCalendarSyncDeps } from '@aria/infrastructure';
import { createServiceRoleSupabaseClient, createUserScopedSupabaseClient, getSupabaseAuthBaseUrl } from './supabase.js';
import {
  registerGoogleWatchForSelectedCalendars,
  syncSelectedCalendarsForUser,
} from '@aria/application';

type SetupSelectionPayload = {
  calendars: Array<{
    providerCalendarId: string;
    name: string;
    color?: string | null;
    timezone?: string;
    selectedForSync: boolean;
  }>;
  primaryWriteProviderCalendarId: string;
};

type CalendarEventCreatePayload = {
  providerCalendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
};

type CalendarEventUpdatePayload = Partial<CalendarEventCreatePayload>;

function json(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function withCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Aria-Source-Surface, X-Goog-Channel-ID, X-Goog-Channel-Token, X-Goog-Resource-ID, X-Goog-Resource-State');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return (raw ? JSON.parse(raw) : {}) as T;
}

function getOAuthUrl(origin: string): string {
  const callback = `${origin}/auth/callback`;
  const url = new URL(`${getSupabaseAuthBaseUrl()}/authorize`);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', callback);
  url.searchParams.set('scopes', 'openid email profile https://www.googleapis.com/auth/calendar');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

async function getUserContext(req: IncomingMessage): Promise<{ token: string; userId: string; email: string | null } | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const client = createUserScopedSupabaseClient(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  return {
    token,
    userId: data.user.id,
    email: data.user.email ?? null,
  };
}

function toScopeMetadata(): string[] {
  return ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar'];
}

type GoogleProviderTokenMetadata = {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
};

function extractGoogleProviderTokenMetadata(user: unknown): GoogleProviderTokenMetadata | null {
  const candidateSources: Array<Record<string, unknown>> = [];
  if (user && typeof user === 'object') {
    const record = user as Record<string, unknown>;
    if (record.app_metadata && typeof record.app_metadata === 'object') {
      candidateSources.push(record.app_metadata as Record<string, unknown>);
    }
    if (record.user_metadata && typeof record.user_metadata === 'object') {
      candidateSources.push(record.user_metadata as Record<string, unknown>);
    }
    if (Array.isArray(record.identities)) {
      for (const identity of record.identities) {
        if (identity && typeof identity === 'object') {
          const identityRecord = identity as Record<string, unknown>;
          candidateSources.push(identityRecord);
          if (identityRecord.identity_data && typeof identityRecord.identity_data === 'object') {
            candidateSources.push(identityRecord.identity_data as Record<string, unknown>);
          }
        }
      }
    }
  }

  for (const source of candidateSources) {
    const accessTokenValue = source.provider_token ?? source.access_token;
    const refreshTokenValue = source.provider_refresh_token ?? source.refresh_token;
    const scopeValue = source.provider_scopes ?? source.scope;

    if (typeof accessTokenValue === 'string' && accessTokenValue.length > 0) {
      return {
        accessToken: accessTokenValue,
        refreshToken: typeof refreshTokenValue === 'string' && refreshTokenValue.length > 0 ? refreshTokenValue : null,
        scope: typeof scopeValue === 'string' && scopeValue.length > 0 ? scopeValue : null,
      };
    }
  }

  return null;
}

async function ensureCalendarAccount(
  token: string,
  userId: string,
  email: string | null,
  options?: { requireProviderTokenMetadata?: boolean },
): Promise<void> {
  const client = createUserScopedSupabaseClient(token);
  const providerAccountId = email ?? userId;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('AUTH_USER_FETCH_FAILED');
  }
  const tokenMetadata = extractGoogleProviderTokenMetadata(userData.user);
  if (options?.requireProviderTokenMetadata && !tokenMetadata) {
    throw new Error('GOOGLE_TOKEN_METADATA_MISSING');
  }

  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    provider: 'google',
    provider_account_id: providerAccountId,
    updated_at: new Date().toISOString(),
  };

  if (tokenMetadata) {
    upsertPayload.encrypted_token_metadata = JSON.stringify({
      access_token: tokenMetadata.accessToken,
      refresh_token: tokenMetadata.refreshToken,
      captured_at: new Date().toISOString(),
    });
    upsertPayload.scope_metadata = tokenMetadata.scope
      ? tokenMetadata.scope.split(' ').map((value) => value.trim()).filter(Boolean)
      : toScopeMetadata();
    upsertPayload.connection_status = 'connected';
  }

  const { error } = await client
    .from('calendar_accounts')
    .upsert(upsertPayload, { onConflict: 'provider,provider_account_id' });

  if (error) throw new Error(`Failed to upsert calendar account: ${error.message}`);
}

async function handleSetupStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });

  const client = createUserScopedSupabaseClient(ctx.token);
  const { data: account, error: accountError } = await client
    .from('calendar_accounts')
    .select('id, provider, provider_account_id')
    .eq('user_id', ctx.userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (accountError || !account) return json(res, 400, { error: 'GOOGLE_ACCOUNT_NOT_CONNECTED' });

  const { data: calendars, error: calendarsError } = await client
    .from('provider_calendars')
    .select('id, provider_calendar_id, name, color, timezone, selected_for_sync, is_primary_write')
    .eq('calendar_account_id', account.id)
    .order('name', { ascending: true });

  if (calendarsError) return json(res, 500, { error: 'CALENDAR_FETCH_FAILED' });

  let availableCalendars = (calendars ?? []).map((cal) => ({
    providerCalendarId: cal.provider_calendar_id,
    name: cal.name,
    color: cal.color,
    timezone: cal.timezone,
    selectedForSync: cal.selected_for_sync,
    isPrimaryWrite: cal.is_primary_write,
  }));

  if (availableCalendars.length === 0) {
    const adapter = createGoogleCalendarAdapterForUser({
      userId: ctx.userId,
      serviceClient: createServiceRoleSupabaseClient(),
      webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
      webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
    });
    const discovered = await adapter.listCalendars(account.provider_account_id);
    availableCalendars = discovered.map((cal) => ({
      providerCalendarId: cal.providerCalendarId,
      name: cal.name,
      color: cal.color,
      timezone: cal.timezone,
      selectedForSync: cal.selectedForSync,
      isPrimaryWrite: cal.isPrimaryWrite,
    }));
  }

  const selectedCount = availableCalendars.filter((cal) => cal.selectedForSync).length;
  const primary = availableCalendars.find((cal) => cal.isPrimaryWrite);

  json(res, 200, {
    provider: 'google',
    account: {
      id: account.id,
      providerAccountId: account.provider_account_id,
    },
    calendars: availableCalendars,
    setupComplete: selectedCount > 0 && Boolean(primary),
  });
}

async function handleSetupSelection(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });

  const payload = await readJson<SetupSelectionPayload>(req);
  const calendars = Array.isArray(payload.calendars) ? payload.calendars : [];

  if (calendars.length === 0) return json(res, 400, { error: 'At least one calendar must be supplied.' });

  const selected = calendars.filter((cal) => cal.selectedForSync);
  if (selected.length === 0) return json(res, 400, { error: 'At least one calendar must be selected for sync.' });

  const primary = payload.primaryWriteProviderCalendarId;
  if (!primary || !selected.some((cal) => cal.providerCalendarId === primary)) {
    return json(res, 400, { error: 'Primary write calendar must be one of the selected calendars.' });
  }

  await ensureCalendarAccount(ctx.token, ctx.userId, ctx.email);

  const client = createUserScopedSupabaseClient(ctx.token);
  const { data: account, error: accountError } = await client
    .from('calendar_accounts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('provider', 'google')
    .single();

  if (accountError || !account) return json(res, 500, { error: 'ACCOUNT_FETCH_FAILED' });

  const rows = calendars.map((cal) => ({
    id: randomUUID(),
    calendar_account_id: account.id,
    provider: 'google',
    provider_calendar_id: cal.providerCalendarId,
    name: cal.name,
    color: cal.color ?? null,
    timezone: cal.timezone ?? 'UTC',
    selected_for_sync: cal.selectedForSync,
    is_primary_write: cal.providerCalendarId === primary,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client.from('provider_calendars').upsert(rows, { onConflict: 'calendar_account_id,provider,provider_calendar_id' });
  if (error) return json(res, 500, { error: `SETUP_SAVE_FAILED: ${error.message}` });

  json(res, 200, { success: true, setupComplete: true });
}

async function handleRunSync(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });

  const adapter = createGoogleCalendarAdapterForUser({
    userId: ctx.userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  const deps = createSupabaseCalendarSyncDeps(createUserScopedSupabaseClient(ctx.token), adapter);
  const result = await syncSelectedCalendarsForUser(deps, {
    userId: ctx.userId,
    sourceSurface: 'system_sync',
  });

  json(res, 200, result);
}

async function handleRegisterWatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });

  const adapter = createGoogleCalendarAdapterForUser({
    userId: ctx.userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  const deps = createSupabaseCalendarSyncDeps(createUserScopedSupabaseClient(ctx.token), adapter);
  const result = await registerGoogleWatchForSelectedCalendars(deps, { userId: ctx.userId });

  json(res, 200, result);
}

async function handleGoogleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const headerToken = req.headers['x-goog-channel-token'];
  const expectedToken = process.env.GOOGLE_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return json(res, 500, { error: 'GOOGLE_WEBHOOK_TOKEN_REQUIRED' });
  }

  if (headerToken !== expectedToken) {
    return json(res, 401, { error: 'INVALID_WEBHOOK_TOKEN' });
  }

  const channelId = (req.headers['x-goog-channel-id'] ?? '').toString();
  if (!channelId) return json(res, 400, { error: 'MISSING_CHANNEL_ID' });

  // Webhook ingress acknowledges notification; background sync trigger is represented
  // by immediate sync call in this runtime for MVP.
  const db = createServiceRoleSupabaseClient();
  const { data: cursor, error } = await db
    .from('calendar_sync_cursors')
    .select('provider_calendar_id, provider_calendars!inner(calendar_account_id, calendar_accounts!inner(user_id))')
    .eq('watch_channel_id', channelId)
    .maybeSingle();

  if (error || !cursor) {
    return json(res, 202, { accepted: true, reason: 'No matching watch cursor.' });
  }

  const userId = (cursor.provider_calendars as unknown as { calendar_accounts: { user_id: string } }).calendar_accounts.user_id;
  const adapter = createGoogleCalendarAdapterForUser({
    userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  const deps = createSupabaseCalendarSyncDeps(db, adapter);
  await syncSelectedCalendarsForUser(deps, { userId, sourceSurface: 'system_sync' });

  json(res, 202, { accepted: true, synced: true });
}

async function getAccountForUser(token: string, userId: string): Promise<{ id: string; providerAccountId: string } | null> {
  const db = createUserScopedSupabaseClient(token);
  const { data, error } = await db
    .from('calendar_accounts')
    .select('id, provider_account_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, providerAccountId: data.provider_account_id };
}

async function handleListCalendarEvents(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });

  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const from = requestUrl.searchParams.get('from');
  const to = requestUrl.searchParams.get('to');

  const db = createUserScopedSupabaseClient(ctx.token);
  const account = await getAccountForUser(ctx.token, ctx.userId);
  if (!account) return json(res, 200, { calendars: [], events: [] });

  const { data: calendars, error: calendarsError } = await db
    .from('provider_calendars')
    .select('provider_calendar_id,name,color,timezone,selected_for_sync,is_primary_write')
    .eq('calendar_account_id', account.id)
    .eq('selected_for_sync', true)
    .order('name', { ascending: true });
  if (calendarsError) return json(res, 500, { error: calendarsError.message });

  let query = db
    .from('calendar_events')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('is_deleted', false)
    .order('start_at', { ascending: true });

  if (from) query = query.gte('start_at', from);
  if (to) query = query.lte('end_at', to);

  const { data: events, error: eventsError } = await query;
  if (eventsError) return json(res, 500, { error: eventsError.message });

  return json(res, 200, {
    calendars: (calendars ?? []).map((calendar) => ({
      providerCalendarId: calendar.provider_calendar_id,
      name: calendar.name,
      color: calendar.color,
      timezone: calendar.timezone,
      selectedForSync: calendar.selected_for_sync,
      isPrimaryWrite: calendar.is_primary_write,
    })),
    events: (events ?? []).map((event) => ({
      id: event.id,
      providerCalendarId: event.provider_calendar_id,
      providerEventId: event.provider_event_id,
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      timezone: event.timezone,
      sourceCalendarName: event.source_calendar_name,
      sourceCalendarColor: event.source_calendar_color,
    })),
  });
}

async function handleCreateCalendarEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });
  const payload = await readJson<CalendarEventCreatePayload>(req);
  const sourceSurface = req.headers['x-aria-source-surface'] === 'floating_chat' ? 'floating_chat' : 'calendar_ui';

  const db = createUserScopedSupabaseClient(ctx.token);
  const account = await getAccountForUser(ctx.token, ctx.userId);
  if (!account) return json(res, 400, { error: 'GOOGLE_ACCOUNT_NOT_CONNECTED' });

  const { data: calendar } = await db
    .from('provider_calendars')
    .select('provider_calendar_id,name,color,timezone')
    .eq('calendar_account_id', account.id)
    .eq('provider_calendar_id', payload.providerCalendarId)
    .maybeSingle();
  if (!calendar) return json(res, 400, { error: 'INVALID_PROVIDER_CALENDAR_ID' });

  const adapter = createGoogleCalendarAdapterForUser({
    userId: ctx.userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  const created = await adapter.createEvent(account.providerAccountId, {
    calendarId: payload.providerCalendarId,
    title: payload.title,
    startAt: payload.startAt,
    endAt: payload.endAt,
    timezone: payload.timezone || calendar.timezone,
  });

  const row = {
    id: created.id,
    user_id: ctx.userId,
    provider: 'google',
    provider_calendar_id: payload.providerCalendarId,
    provider_event_id: created.providerEventId,
    title: created.title,
    start_at: created.startAt,
    end_at: created.endAt,
    timezone: created.timezone,
    source_calendar_name: calendar.name,
    source_calendar_color: calendar.color,
    sync_status: 'synced',
    etag: created.etag,
    is_deleted: false,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await db.from('calendar_events').upsert(row, { onConflict: 'provider,provider_calendar_id,provider_event_id' });
  if (error) return json(res, 500, { error: error.message });

  await db.from('calendar_operation_log').insert({
    user_id: ctx.userId,
    actor: 'user',
    source_surface: sourceSurface,
    action_type: 'create_event',
    target_ref: created.providerEventId,
    result: 'success',
    provider_metadata: { provider: 'google', providerCalendarId: payload.providerCalendarId },
  });

  return json(res, 200, { success: true, event: row });
}

async function handleUpdateCalendarEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });
  const payload = await readJson<CalendarEventUpdatePayload>(req);
  const sourceSurface = req.headers['x-aria-source-surface'] === 'floating_chat' ? 'floating_chat' : 'calendar_ui';

  const db = createUserScopedSupabaseClient(ctx.token);
  const account = await getAccountForUser(ctx.token, ctx.userId);
  if (!account) return json(res, 400, { error: 'GOOGLE_ACCOUNT_NOT_CONNECTED' });

  const { data: existing } = await db
    .from('calendar_events')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('id', eventId)
    .maybeSingle();
  if (!existing) return json(res, 404, { error: 'EVENT_NOT_FOUND' });

  const { data: calendar } = await db
    .from('provider_calendars')
    .select('provider_calendar_id,name,color,timezone')
    .eq('calendar_account_id', account.id)
    .eq('provider_calendar_id', payload.providerCalendarId || existing.provider_calendar_id)
    .maybeSingle();
  if (!calendar) return json(res, 400, { error: 'INVALID_PROVIDER_CALENDAR_ID' });
  if (payload.providerCalendarId && payload.providerCalendarId !== existing.provider_calendar_id) {
    return json(res, 400, { error: 'CROSS_CALENDAR_MOVE_NOT_SUPPORTED' });
  }

  const adapter = createGoogleCalendarAdapterForUser({
    userId: ctx.userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  const updated = await adapter.updateEvent(account.providerAccountId, existing.provider_event_id, {
    calendarId: calendar.provider_calendar_id,
    title: payload.title ?? existing.title,
    startAt: payload.startAt ?? existing.start_at,
    endAt: payload.endAt ?? existing.end_at,
    timezone: payload.timezone ?? existing.timezone,
  });

  const row = {
    id: existing.id,
    user_id: ctx.userId,
    provider: 'google',
    provider_calendar_id: calendar.provider_calendar_id,
    provider_event_id: updated.providerEventId,
    title: updated.title,
    start_at: updated.startAt,
    end_at: updated.endAt,
    timezone: updated.timezone,
    source_calendar_name: calendar.name,
    source_calendar_color: calendar.color,
    sync_status: 'synced',
    etag: updated.etag,
    is_deleted: false,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await db.from('calendar_events').upsert(row, { onConflict: 'provider,provider_calendar_id,provider_event_id' });
  if (error) return json(res, 500, { error: error.message });

  await db.from('calendar_operation_log').insert({
    user_id: ctx.userId,
    actor: 'user',
    source_surface: sourceSurface,
    action_type: 'update_event',
    target_ref: updated.providerEventId,
    result: 'success',
    provider_metadata: { provider: 'google', providerCalendarId: calendar.provider_calendar_id },
  });

  return json(res, 200, { success: true, event: row });
}

async function handleDeleteCalendarEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
  const ctx = await getUserContext(req);
  if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });
  const sourceSurface = req.headers['x-aria-source-surface'] === 'floating_chat' ? 'floating_chat' : 'calendar_ui';

  const db = createUserScopedSupabaseClient(ctx.token);
  const account = await getAccountForUser(ctx.token, ctx.userId);
  if (!account) return json(res, 400, { error: 'GOOGLE_ACCOUNT_NOT_CONNECTED' });

  const { data: existing } = await db
    .from('calendar_events')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('id', eventId)
    .maybeSingle();
  if (!existing) return json(res, 404, { error: 'EVENT_NOT_FOUND' });

  const adapter = createGoogleCalendarAdapterForUser({
    userId: ctx.userId,
    serviceClient: createServiceRoleSupabaseClient(),
    webhookUrl: process.env.GOOGLE_WEBHOOK_URL,
    webhookToken: process.env.GOOGLE_WEBHOOK_TOKEN,
  });
  await adapter.deleteEvent(account.providerAccountId, existing.provider_calendar_id, existing.provider_event_id);

  const { error } = await db
    .from('calendar_events')
    .update({
      is_deleted: true,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('user_id', ctx.userId);
  if (error) return json(res, 500, { error: error.message });

  await db.from('calendar_operation_log').insert({
    user_id: ctx.userId,
    actor: 'user',
    source_surface: sourceSurface,
    action_type: 'delete_event',
    target_ref: existing.provider_event_id,
    result: 'success',
    provider_metadata: { provider: 'google', providerCalendarId: existing.provider_calendar_id },
  });

  return json(res, 200, { success: true });
}

const server = createServer(async (req, res) => {
  if (withCors(req, res)) return;

  const method = req.method ?? 'GET';
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (method === 'GET' && requestUrl.pathname === '/health') {
      json(res, 200, { ok: true, service: 'aria-api' });
      return;
    }

    if (method === 'GET' && requestUrl.pathname === '/v1/auth/google/start') {
      const origin = req.headers.origin ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173';
      json(res, 200, { url: getOAuthUrl(origin) });
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/auth/google/finalize') {
      const ctx = await getUserContext(req);
      if (!ctx) return json(res, 401, { error: 'UNAUTHORIZED' });
      await ensureCalendarAccount(ctx.token, ctx.userId, ctx.email, { requireProviderTokenMetadata: true });
      json(res, 200, { success: true });
      return;
    }

    if (method === 'GET' && requestUrl.pathname === '/v1/calendar/setup/status') {
      await handleSetupStatus(req, res);
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/calendar/setup/selection') {
      await handleSetupSelection(req, res);
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/calendar/sync/run') {
      await handleRunSync(req, res);
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/calendar/watch/register') {
      await handleRegisterWatch(req, res);
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/providers/google/webhook') {
      await handleGoogleWebhook(req, res);
      return;
    }

    if (method === 'GET' && requestUrl.pathname === '/v1/calendar/events') {
      await handleListCalendarEvents(req, res);
      return;
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/calendar/events') {
      await handleCreateCalendarEvent(req, res);
      return;
    }

    if (method === 'PATCH' && requestUrl.pathname.startsWith('/v1/calendar/events/')) {
      const eventId = requestUrl.pathname.replace('/v1/calendar/events/', '');
      await handleUpdateCalendarEvent(req, res, eventId);
      return;
    }

    if (method === 'DELETE' && requestUrl.pathname.startsWith('/v1/calendar/events/')) {
      const eventId = requestUrl.pathname.replace('/v1/calendar/events/', '');
      await handleDeleteCalendarEvent(req, res, eventId);
      return;
    }

    json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    json(res, 500, { error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[aria-api] listening on :${port}`);
});

