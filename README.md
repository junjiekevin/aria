# Aria

Aria v2.1 is being repositioned as an AI scheduling orchestration layer on top of external calendars, starting with Google Calendar. The target experience is calendar-first, with a full synced calendar UI as the authenticated home page and a floating assistant as the main command surface.

The current codebase still contains the legacy standalone scheduling product in implementation terms. For the revamp direction, use `docs/agents/context` as the source of truth.

## Current Repo Snapshot

The repository currently contains:
- a legacy Vite SPA
- a schedule-centric data model
- floating chat tied to legacy scheduling tools
- public availability forms
- Supabase-backed CRUD and edge functions

These are implementation starting points, not the final v2.1 architecture.

## v2.1 Direction

- **Calendar-First Product** -- Full calendar UI is the main authenticated surface.
- **Floating Aria** -- The assistant remains a floating chat layer, not a separate page.
- **Google-First Sync** -- Google Calendar is the first active provider and system of record for event truth.
- **Provider-Neutral Core** -- Internal contracts should support future Apple, Outlook, and CalDAV integrations.
- **Availability Intake** -- Public forms remain in scope as workflow intake, not as primary calendar truth.
- **Server-First Execution** -- Privileged auth, sync, tool execution, and provider calls must move behind a server layer.

## Tech Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite                         |
| Styling        | Vanilla CSS, CSS Modules                           |
| Database       | Supabase (PostgreSQL)                              |
| Edge Functions | Deno (Supabase Edge)                               |
| Authentication | Google OAuth (Supabase Auth)                       |
| Communications | Resend API                                         |
| AI             | OpenRouter API, Google Gemini 2.5 Flash Lite       |
| Drag and Drop  | dnd-kit                                            |
| Deployment     | Vercel                                             |

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- A [Supabase](https://supabase.com) project with Google OAuth configured
- An [OpenRouter](https://openrouter.ai) API key

### Installation

```bash
git clone https://github.com/junjiekevin/aria.git
cd aria
npm install
```

### Configuration

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Set server-side secrets in Supabase Edge Functions environment:

```
OPENROUTER_API_KEY=<your-openrouter-key>
RESEND_API_KEY=<your-resend-api-key>
EDGE_LINK_SIGNING_SECRET=<long-random-secret>
```

### Development

```bash
npm run dev       # Start dev server with HMR
npm run build     # TypeScript compile + production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
npm run test:integration # Run automated integration tests
```

## Project Structure

```
aria/
├── src/
│   ├── App.tsx                 # Root component and routing
│   ├── components/             # Reusable UI components and modals
│   ├── pages/                  # Route-level page components
│   ├── lib/
│   │   ├── api/                # Supabase data access layer
│   │   ├── services/           # Business logic and orchestration layer
│   │   ├── aria/               # AI prompt builder and function registry
│   │   ├── openrouter.ts       # OpenRouter API client
│   │   ├── scheduling.ts       # Auto-schedule algorithm
│   │   └── export.ts           # iCal and PDF export utilities
│   └── styles/                 # Design tokens and global styles
├── supabase/
│   ├── functions/              # Deno Edge Functions (get-ics, publish-schedule, cancel-event)
│   └── migrations/             # SQL schema and RLS migrations
├── vercel.json                 # Vercel SPA rewrite configuration
└── package.json
```

## Deployment

The application is deployed on [Vercel](https://vercel.com). Push to the main branch to trigger a production deployment. The `vercel.json` configuration handles SPA routing via a catch-all rewrite to `index.html`.

## License

This project is proprietary. All rights reserved.
