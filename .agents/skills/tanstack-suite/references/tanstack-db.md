# TanStack DB

Official docs: https://tanstack.com/db/latest

TanStack DB is a **reactive client-side database** with live queries and sync-oriented primitives.

Use it when you need:

- Local-first reads/writes (fast UX even offline)
- Reactive queries that update the UI automatically
- A path toward syncing to a server

TanStack DB is newer than other TanStack libraries (often labeled beta), so verify APIs against the official docs when implementing.

## Install (React)

```bash
npm i @tanstack/db @tanstack/react-db
```

## Core concepts

### Database + Collections

DB is typically organized into **collections** (like tables) with:

- A name
- A schema / record type
- A primary key extractor
- Optional sync configuration

### Live queries

Live queries are reactive: when records change, the query results update.

In React, you’ll commonly use `useLiveQuery` (or similar adapter APIs).

## Minimal example (conceptual)

> This is a conceptual example to convey structure; check the DB docs for exact names and options.

```tsx
import { createCollection, useLiveQuery } from '@tanstack/react-db'

type Todo = { id: string; title: string; done: boolean }

const todos = createCollection<Todo>({
  name: 'todos',
  getKey: (t) => t.id,
})

export function TodoList() {
  const result = useLiveQuery(() => todos.findMany())
  return (
    <ul>
      {result.data?.map((t) => (
        <li key={t.id}>{t.title}</li>
      ))}
    </ul>
  )
}
```

## Query builder

DB commonly supports query builder helpers (e.g. `eq`, `and`, `orderBy`) for typed filtering.

Guidelines:

- Keep query expressions near the UI that needs them
- Avoid dynamically constructing untyped query objects
- Prefer stable query definitions when possible

## Sync + server integration

A typical local-first pattern:

- UI writes to the local collection immediately
- A sync layer mirrors writes to the server
- Server responses reconcile local state

If you need server-state caching (and your sync layer is HTTP-based), consider:

- DB for local persistence + live reads
- Query for network fetch/mutation caching and retries

## DB + Query

Two common integration approaches:

1. **Query drives DB**
   - Query fetches remote data
   - On success, write data into DB
   - UI reads from DB via live queries

2. **DB drives Query invalidation**
   - DB is canonical locally
   - Network mutations occur separately
   - When network sync completes, invalidate or refetch related Query keys

If your app is already Query-heavy, approach (1) is a gentle migration path.

## Gotchas

- DB is evolving quickly; pin versions and keep them aligned across adapters.
- Decide what the “source of truth” is (DB vs server) and be consistent.

## Next references

- Query: `references/tanstack-query.md`
- Store: `references/tanstack-store.md`
