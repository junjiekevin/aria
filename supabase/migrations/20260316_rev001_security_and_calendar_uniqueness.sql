-- REV-001 follow-up fixes:
-- 1) Keep provider token metadata server-only.
-- 2) Scope provider calendar uniqueness per connected account.

-- Replace global provider calendar uniqueness with account-scoped uniqueness.
ALTER TABLE public.provider_calendars
  DROP CONSTRAINT IF EXISTS provider_calendars_provider_provider_calendar_id_key;

DROP INDEX IF EXISTS public.provider_calendars_provider_provider_calendar_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_calendars_account_provider_calendar_unique
  ON public.provider_calendars(calendar_account_id, provider, provider_calendar_id);

-- Restrict authenticated SELECT access on token-bearing table to non-secret columns.
REVOKE SELECT ON public.calendar_accounts FROM authenticated;

GRANT SELECT (
  id,
  user_id,
  provider,
  provider_account_id,
  scope_metadata,
  connection_status,
  created_at,
  updated_at
) ON public.calendar_accounts TO authenticated;
