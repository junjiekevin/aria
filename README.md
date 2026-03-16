# Aria

Aria v2.1 is being rebuilt as a calendar-first orchestration product on top of external calendars, starting with Google Calendar. The target experience is a full synced calendar workspace as the authenticated home page with a floating assistant as the main command surface.

The repository is currently in a hybrid monorepo migration state. For active product, architecture, and sprint direction, use `docs/agents/context`, `docs/logs/handover_board.md`, and `docs/logs/engineering_backlog.md` as the source of truth instead of stale legacy wording.

## Current Repo Snapshot

The repository currently contains:
- `apps/web` as the current frontend runtime shell
- `apps/api` as the current server-managed execution shell
- shared workspace packages under `packages/`
- root `src/` retained as a migration compatibility surface
- Supabase-backed canonical calendar schema plus retained legacy CRUD
- retained Supabase edge functions for a narrow set of temporary runtime boundaries

These are implementation starting points, not the final v2.1 architecture.

## v2.1 Direction

- **Calendar-First Product**: Full calendar UI is the main authenticated surface.
- **Floating Aria**: The assistant remains a floating chat layer, not a separate page.
- **Google-First Sync**: Google Calendar is the first active provider and system of record for event truth.
- **Provider-Neutral Core**: Internal contracts should support future Apple, Outlook, and CalDAV integrations.
- **Availability Intake**: Public forms remain in scope as workflow intake, not as primary calendar truth.
- **Server-First Execution**: Privileged auth, sync, tool execution, and provider calls must move behind a server layer.

## Current Runtime And Target Stack

| Layer | Current Runtime | Target Direction |
| ----- | --------------- | ---------------- |
| Frontend | React 18, TypeScript, Vite shell in `apps/web` | Next.js app as the long-term frontend runtime |
| Server | Node HTTP server scaffold in `apps/api` plus retained Supabase edge functions | Server-side execution layer handling privileged backend logic and frontend API traffic |
| Database/Auth/Storage | Supabase | Supabase |
| Shared Business Logic | Workspace packages plus legacy root `src/` seams | Workspace-owned domain/application/infrastructure packages |
| AI Execution | OpenRouter-backed assistant flows | Intent-routed tool execution with narrowed callable surfaces |
| Provider Integration | Google Calendar APIs | Google-first, provider-neutral adapter model |
| Deployment Target | Local hybrid runtime during migration | Cloud-ready server deployment with portable monorepo packaging |

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or pnpm
- a Supabase project with Google OAuth configured
- provider and API credentials required by the current local environment contract

### Installation

```bash
git clone https://github.com/junjiekevin/aria.git
cd aria
npm install
```

### Configuration

The environment contract is now published in [`.env.example`](./.env.example).

Local setup:
1. Copy `.env.example` to `.env`.
2. Fill required placeholders with real non-committed values.
3. Keep optional/defaulted keys as-is unless your local/runtime scenario needs overrides.

Coverage in this contract includes:
- `apps/web` and compatibility `src/*` runtime keys
- `apps/api` runtime keys
- retained `supabase/functions/*` edge-runtime keys

### Development

```bash
npm run dev               # Alias for the current web runtime
npm run dev:web           # Start the frontend shell in apps/web
npm run dev:api           # Build and start the server shell in apps/api
npm run build:workspaces  # Build the active workspace packages and apps
npm run test:workspaces   # Run the active workspace test suite
```

## Project Structure

```text
aria/
|- apps/
|  |- web/                    # Current frontend runtime shell
|  `- api/                    # Current server-managed execution shell
|- packages/
|  |- domain/                 # Shared domain contracts and entities
|  `- application/            # Shared application handlers and orchestration contracts
|- src/                       # Legacy compatibility surface pending migration
|- supabase/
|  |- functions/              # Retained temporary edge-runtime boundaries
|  `- migrations/             # Canonical calendar schema and legacy migrations
|- docs/
|  |- agents/context/         # Source-of-truth product, architecture, and sprint docs
|  `- logs/                   # Handover board and engineering backlog
`- package.json
```

## Current Sprint

The active sprint is `PHASE-1 - Monorepo And Runtime Reset`. Phase 1 is only considered closed once:
- `.env.example` is published
- local `.env` is populated from that contract
- QA closeout completes
- reviewer closeout completes

## License

This project is proprietary. All rights reserved.
