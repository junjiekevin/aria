# Edge Boundary During Migration

`apps/api` is now the runtime home for server-managed execution.

Temporary retained edge-runtime surfaces under `supabase/functions/`:
- `cancel-event`
- `get-ics`
- `openrouter-chat`
- `publish-schedule`

New v2.1 privileged backend behavior should default to `apps/api` unless a strict edge-runtime requirement is identified.
