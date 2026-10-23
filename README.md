# DevMind AI

A production-oriented AI software engineering platform built with React + TypeScript, Vite, Tailwind CSS, and a secure server-side AI boundary.

## Features

- Premium dashboard and project overview
- Workspace with file explorer, Monaco editor, terminal, problems panel, diff, search, and AI chat
- AI engineer workflow with plan, patch review, and bounded validation loop
- Provider-independent AI integration boundary with OpenAI/Anthropic/Google support via env vars
- Optional local persistence through browser storage and server API
- Build/test automation with Vitest

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Monaco editor
- Backend: Node.js + Express + TypeScript
- AI: server-side provider integration via `fetch` with environment-configured secrets
- Security: validated inputs, permission-aware API, env-only secrets, no client-side API keys

## Quick start

1. Install dependencies:

   npm install

2. Configure environment variables (optional but recommended):

   cp .env.example .env

3. Start the app:

   npm run dev

4. Open the frontend at http://localhost:5173 and the API at http://localhost:3001/api/health.

## Environment variables

Create a `.env` file at the repo root before running the server with provider credentials.

```bash
PORT=3001
AI_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

When credentials are missing, the app still runs in a safe, guided mode and shows a clear setup banner instead of pretending the AI backend is active.

## Database and persistence

This milestone uses browser persistence for the collaborative workspace and an API boundary for AI requests. For production, connect Supabase or another database using environment variables and add migration files under `supabase/`.

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Architecture

- `src/` — React frontend application
- `server/` — Node/Express API boundary
- `vite.config.ts` — Vite frontend + proxy configuration
- `README.md` — setup and deployment guidance

## Security notes

- No API keys are exposed to the browser bundle.
- Provider calls are sent server-side.
- Untrusted project content is treated as input to requests and never blindly executed.
- Destructive or high-risk actions require approval before being run.

## Production guidance

- Add authentication and project permissions in Supabase or your chosen auth provider.
- Move additional project data and user preferences into a persistent database.
- Add a sandboxed execution service for running user code under CPU, memory, and network constraints.
- Add CI checks for linting, tests, and build validation.
