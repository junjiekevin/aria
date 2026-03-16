-- BLD-002: Canonical calendar schema foundation for Aria v2.1

CREATE TABLE IF NOT EXISTS public.calendar_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('google')),
    provider_account_id text NOT NULL,
    encrypted_token_metadata text,
    scope_metadata text[] DEFAULT ARRAY[]::text[],
    connection_status text NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'revoked', 'error')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_accounts_user_provider
    ON public.calendar_accounts(user_id, provider);

CREATE TABLE IF NOT EXISTS public.provider_calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_account_id uuid NOT NULL REFERENCES public.calendar_accounts(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('google')),
    provider_calendar_id text NOT NULL,
    name text NOT NULL,
    color text,
    timezone text NOT NULL DEFAULT 'UTC',
    selected_for_sync boolean NOT NULL DEFAULT false,
    is_primary_write boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_calendars_account
    ON public.provider_calendars(calendar_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_calendars_single_primary
    ON public.provider_calendars(calendar_account_id)
    WHERE is_primary_write = true;

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('google')),
    provider_calendar_id text NOT NULL,
    provider_event_id text NOT NULL,
    title text NOT NULL DEFAULT '',
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    timezone text NOT NULL DEFAULT 'UTC',
    source_calendar_name text NOT NULL DEFAULT '',
    source_calendar_color text,
    sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_write', 'sync_error')),
    last_synced_at timestamptz,
    etag text,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_calendar_id, provider_event_id),
    CHECK (start_at < end_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
    ON public.calendar_events(user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider_ref
    ON public.calendar_events(provider, provider_calendar_id, provider_event_id);

CREATE TABLE IF NOT EXISTS public.event_workflow_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    workflow_status text NOT NULL DEFAULT 'none',
    reminder_state text,
    follow_up_state text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (calendar_event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_workflow_state_event
    ON public.event_workflow_state(calendar_event_id);

CREATE TABLE IF NOT EXISTS public.calendar_sync_cursors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_calendar_id uuid NOT NULL REFERENCES public.provider_calendars(id) ON DELETE CASCADE,
    sync_token text,
    watch_channel_id text,
    watch_resource_id text,
    watch_expires_at timestamptz,
    last_successful_sync_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_cursors_watch_exp
    ON public.calendar_sync_cursors(watch_expires_at);

CREATE TABLE IF NOT EXISTS public.calendar_operation_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor text NOT NULL CHECK (actor IN ('user', 'assistant', 'system')),
    source_surface text NOT NULL CHECK (source_surface IN ('calendar_ui', 'floating_chat', 'system_sync')),
    action_type text NOT NULL,
    target_ref text NOT NULL,
    result text NOT NULL CHECK (result IN ('success', 'failure')),
    error_payload jsonb,
    provider_metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_operation_log_user_created
    ON public.calendar_operation_log(user_id, created_at DESC);

ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_workflow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_operation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Owners manage own calendar accounts"
    ON public.calendar_accounts
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners manage own provider calendars" ON public.provider_calendars;
CREATE POLICY "Owners manage own provider calendars"
    ON public.provider_calendars
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.calendar_accounts ca
            WHERE ca.id = provider_calendars.calendar_account_id
              AND ca.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.calendar_accounts ca
            WHERE ca.id = provider_calendars.calendar_account_id
              AND ca.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners manage own calendar events" ON public.calendar_events;
CREATE POLICY "Owners manage own calendar events"
    ON public.calendar_events
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners manage own event workflow state" ON public.event_workflow_state;
CREATE POLICY "Owners manage own event workflow state"
    ON public.event_workflow_state
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.calendar_events ce
            WHERE ce.id = event_workflow_state.calendar_event_id
              AND ce.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.calendar_events ce
            WHERE ce.id = event_workflow_state.calendar_event_id
              AND ce.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners manage own sync cursors" ON public.calendar_sync_cursors;
CREATE POLICY "Owners manage own sync cursors"
    ON public.calendar_sync_cursors
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.provider_calendars pc
            JOIN public.calendar_accounts ca ON ca.id = pc.calendar_account_id
            WHERE pc.id = calendar_sync_cursors.provider_calendar_id
              AND ca.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.provider_calendars pc
            JOIN public.calendar_accounts ca ON ca.id = pc.calendar_account_id
            WHERE pc.id = calendar_sync_cursors.provider_calendar_id
              AND ca.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can read own calendar operation logs" ON public.calendar_operation_log;
CREATE POLICY "Owners can read own calendar operation logs"
    ON public.calendar_operation_log
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can append own calendar operation logs" ON public.calendar_operation_log;
CREATE POLICY "Owners can append own calendar operation logs"
    ON public.calendar_operation_log
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
