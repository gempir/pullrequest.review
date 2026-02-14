# TanStack Query

Official docs: https://tanstack.com/query/latest

TanStack Query is **asynchronous server-state management**: caching, deduping, retries, background refetching, mutations, pagination, and more.

This reference is for **React Query v5**.

## Install (React)

```bash
npm i @tanstack/react-query
```

Devtools (optional but recommended in dev):

```bash
npm i -D @tanstack/react-query-devtools
```

## Baseline setup

Create a single `QueryClient` and wrap your app:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

## Query keys

Query keys are how Query identifies cached data.

Guidelines:

- Use **array keys** (`['posts', postId]`)
- Keep keys stable and namespaced
- Prefer `queryOptions(...)` or shared key factories in larger apps

Example:

```ts
export const postKeys = {
  all: ['posts'] as const,
  detail: (postId: string) => ['posts', postId] as const,
}
```

## useQuery

```tsx
import { useQuery } from '@tanstack/react-query'

function Post({ postId }: { postId: string }) {
  const query = useQuery({
    queryKey: ['posts', postId],
    queryFn: () => fetch(`/api/posts/${postId}`).then((r) => r.json()),
  })

  if (query.isLoading) return <div>Loading…</div>
  if (query.isError) return <div>Error: {String(query.error)}</div>

  return <pre>{JSON.stringify(query.data, null, 2)}</pre>
}
```

## Mutations

Use mutations for writes, then invalidate or update caches.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function RenamePost({ postId }: { postId: string }) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts', postId] })
    },
  })

  return (
    <button onClick={() => mutation.mutate('New title')} disabled={mutation.isPending}>
      Rename
    </button>
  )
}
```

## Pagination and infinite queries

- Use `useInfiniteQuery` for cursor-based pagination
- Use `keepPreviousData`-style patterns for page-based UIs

## SSR + hydration (Start)

When SSR is involved:

- Create a **fresh QueryClient per request** on the server
- Prefetch queries during routing/loader
- Dehydrate the cache to the client
- Hydrate on the client before rendering query hooks

Start can orchestrate this with Router loaders + per-request context.

## Router integration

Good division of responsibilities:

- Router loader decides *what* should be available for a route
- Query does caching/refetching

Loader prefetch example (conceptual):

```ts
loader: async ({ context, params }) => {
  await context.queryClient.prefetchQuery({
    queryKey: ['posts', params.postId],
    queryFn: () => fetchPost(params.postId),
  })
}
```

## Devtools

In React, install `@tanstack/react-query-devtools` and include it in dev.

Typical usage:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function DevOnlyTools() {
  if (import.meta.env.PROD) return null
  return <ReactQueryDevtools initialIsOpen={false} />
}
```

## Common pitfalls

- Duplicate copies of `@tanstack/react-query` in monorepos
- Unstable query keys (objects created inline without memoization)
- Prefetching without hydration (causes double-fetch)

## Next references

- Start: `references/tanstack-start.md`
- Router: `references/tanstack-router.md`
- DB integration: `references/tanstack-db.md`
- Devtools: `references/tanstack-devtools.md`
