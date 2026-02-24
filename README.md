# Aria

Aria is an intelligent scheduling assistant that helps organizers build, manage, and optimize timetables. It combines a visual weekly grid with an AI-powered chat interface that can create, move, swap, and delete events through natural language.

## Features

- **AI Scheduling Assistant** -- Conversational interface powered by Google Gemma 3 27B IT (via OpenRouter). Supports natural-language event creation, conflict detection, capacity analysis, and multi-step agentic operations.
- **Visual Timetable** -- Weekly grid with configurable working hours and drag-and-drop support for assigning, moving, and swapping events (built with dnd-kit).
- **Availability Forms** -- Shareable public links that allow participants to submit preferred time slots without needing an account.
- **Agentic Operations (Edge)** -- Deno-based Supabase Edge Functions handle complex asynchronous workflows like grouping participants and distributing ICS files.
- **Smart Notifications** -- Automated email dispatch via the Resend API keeps participants informed of schedule finalizations and provides encrypted cancellation links.
- **Auto-Scheduling** -- Algorithm-driven participant placement with a preview-and-confirm workflow.
- **Recurring Events** -- Support for one-time, weekly, bi-weekly, and monthly recurrence using RRULE format.
- **Export** -- iCal (.ics) export for calendar applications and branded PDF generation for print, with zero external dependencies.
- **Authentication** -- Google OAuth sign-in via Supabase Auth.
- **Zero-Trust Data Security** -- Row Level Security (RLS) policies enforce strict tenant isolation at the database level. The AI assistant and edge functions operate under tight policy constraints, ensuring participants can only access explicitly permitted data.

## Tech Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite                         |
| Styling        | Vanilla CSS, CSS Modules                           |
| Database       | Supabase (PostgreSQL)                              |
| Edge Functions | Deno (Supabase Edge)                               |
| Authentication | Google OAuth (Supabase Auth)                       |
| Communications | Resend API                                         |
| AI             | OpenRouter API, Google Gemma 3 27B IT              |
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
VITE_OPENROUTER_API_KEY=<your-openrouter-key>
RESEND_API_KEY=<your-resend-api-key>
```

### Development

```bash
npm run dev       # Start dev server with HMR
npm run build     # TypeScript compile + production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
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
