# TanStack Start

Official docs: https://tanstack.com/start/latest

TanStack Start is a **full-stack React framework** built on TanStack Router.

Use Start when you want:

- File-based routing + type-safe navigation
- SSR + streaming + hydration handled as a cohesive system
- A “single app” mental model (client + server code in one repo)
- Server-side actions/functions without bolting on a separate backend

This reference is written for **React Start**.

## Create a new Start app

```bash
npm create @tanstack/start@latest my-app
cd my-app
npm run dev
```

Common follow-up installs for a typical app:

```bash
npm i @tanstack/react-query
npm i -D @tanstack/react-query-devtools
```

## Core concepts to keep straight

### 1) Start is Router-first

- Routing is powered by **TanStack Router**.
- Many "framework" features (data loading, route context, redirects) are Router patterns.

### 2) Server-only code boundaries

Start supports patterns like **server functions**. Treat these rules as hard constraints:

- Provider API keys **must not** be shipped to the browser.
- Database credentials **must not** be shipped to the browser.
- Put secrets in environment variables and access them from server-only code.

### 3) Data loading strategy

You generally have three (often complementary) approaches:

- **Router loaders** (route-coupled data)
- **Query** (cache + background refetch + mutations)
- **DB** (local-first live queries)

A solid default:

- Use Router loaders to orchestrate the route and call `queryClient.prefetchQuery(...)`.
- Use Query hooks (`useQuery`) for rendering and cache access.

## Typical patterns

### Root route + document shell

Start apps frequently render a Router root route that provides the document structure.

You’ll usually see Router primitives like `Outlet`, `Link`, `Scripts`, etc.

### Auth

A common Start approach:

1. Root route defines an `auth` object in Router context.
2. Route loaders check `auth` and redirect if needed.
3. Server functions handle login/logout and session management.

### Server functions

A common pattern (conceptual):

```ts
import { createServerFn } from '@tanstack/react-start'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  // server-only: read session, hit DB, etc
  return { id: '...', email: '...' }
})
```

## When Start + Query + Router overlap

- Prefer **Router loaders** for “this route can’t render without X”.
- Prefer **Query** for “this data should be cached, refetched, shared across routes”.
- Prefer **DB** for local-first state where reads should be reactive and near-instant.

## Gotchas

- **Version drift** between Start + Router packages can cause hard-to-debug failures.
- Don’t put secrets in route modules that get bundled for the client.
- When combining SSR + Query, confirm you have a single QueryClient per request on the server.

## Next references

- Router details: `references/tanstack-router.md`
- Query details: `references/tanstack-query.md`
- Devtools setup: `references/tanstack-devtools.md`

## File-based routing in Start

Start projects generally use **file-based routing** powered by the Router tooling.

- Routes live in a routes directory (commonly something like `app/routes/` or `src/routes/`).
- A **generated route tree** file is created by the Router tooling.

Practical guidance:

- Treat the generated route tree as **build output**. Do not hand-edit it.
- If routing breaks, verify:
  - The Router plugin is configured (see `scripts/tanstack-router-plugin-check.mjs`).
  - The generated route tree exists and is committed (if your workflow commits it).

## Start + Form

For forms in Start:

- Use **TanStack Form** for client UX (field state, validation, submission state).
- Use Start server functions or Router actions for canonical server validation.

Example structure (conceptual):

- `routes/signup.tsx` renders a `<SignupForm />`
- `server/signup.ts` exports a server function for the write
- `SignupForm` calls the server function and maps errors back to fields

See: `references/tanstack-form.md`

## Start + AI

A safe default:

- AI provider calls happen in server-only code (server function or route action).
- The client talks to your server endpoint.
- Streaming responses use SSE (or equivalent streaming transport).

See: `references/tanstack-ai.md`

## Debugging

- Router devtools can save hours when diagnosing loader/redirect/search param issues.
- Query devtools help confirm cache keys, background refetch, mutation state.
- TanStack Devtools unified panel is becoming the standard host for plugins.

See: `references/tanstack-devtools.md`
