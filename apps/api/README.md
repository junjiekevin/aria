# apps/api

Workspace home for server-managed execution (OAuth callbacks, provider sync, webhook ingress, and privileged command handlers).

Current state:
- Node/TypeScript runtime scaffold is active at `apps/api/src/server.ts`.
- Health endpoint exists at `GET /health`.
- Route placeholders exist for OAuth callback, provider webhook ingress, and calendar command execution.
- Existing `supabase/functions/*` remain as temporary edge-runtime boundaries until migrated.
