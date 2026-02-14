# TanStack Router

Official docs: https://tanstack.com/router/latest

TanStack Router is a **fully type-safe router** (links, params, search, loaders, actions) with strong TypeScript inference.

This reference focuses on **React Router v1**.

## Install (React)

### Recommended: scaffold a starter

```bash
npx create-tsrouter-app@latest my-app
cd my-app
npm run dev
```

### Manual setup (Vite)

```bash
npm i @tanstack/react-router
npm i -D @tanstack/router-plugin
```

Optional but recommended:

```bash
npm i -D @tanstack/react-router-devtools
```

## File-based routing + generated route tree

TanStack Router’s file-based setup typically uses:

- A routes directory (e.g. `src/routes/`)
- A generated route tree file (often named `routeTree.gen.ts`)
- The bundler plugin (`@tanstack/router-plugin`) to generate/update the tree

### Vite plugin placement

In Vite configs you’ll usually add the router plugin in the `plugins: []` list.

If route generation is flaky:

- Ensure the router plugin is present.
- Ensure it runs in the correct order.
- Re-run your dev server to trigger regeneration.

Use `scripts/tanstack-router-plugin-check.mjs` to sanity-check.

## Core primitives

### Root route

A common root route pattern uses a typed context:

```ts
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface RouterContext {
  // e.g. auth, queryClient, featureFlags...
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: function Root() {
    return <Outlet />
  },
})
```

### File routes

A typical file-route shape:

```ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    return { postId: params.postId }
  },
  component: PostRoute,
})

function PostRoute() {
  const { postId } = Route.useParams()
  return <div>Post: {postId}</div>
}
```

### Navigation

- `<Link to="..." />` for navigation
- `useNavigate()` for imperative navigation
- Route-aware helpers like `Route.useParams()` and `Route.useSearch()` keep types tight

## Loaders and actions

### Loaders

Use loaders for:

- Route-coupled data
- Redirect-on-load logic
- Prefetching Query data

Loader pattern with Query prefetching (conceptual):

```ts
loader: async ({ context, params }) => {
  await context.queryClient.prefetchQuery({
    queryKey: ['post', params.postId],
    queryFn: () => fetchPost(params.postId),
  })
}
```

### Actions

Use actions for:

- Form submissions
- Mutations that naturally belong to a route
- Returning structured errors

## Search params

TanStack Router can treat search params as part of the type system.

Practical guidance:

- Keep search param parsing/serialization centralized.
- Don’t let “stringly typed” query params leak everywhere.

## Code splitting & preloading

For large apps:

- Enable route-level code splitting
- Use preloading to reduce navigation latency

## SSR notes

- In **TanStack Start**, Router SSR is part of the framework.
- In a custom SSR setup, ensure the server creates the router per request and hydrates correctly.

## Devtools

Router has dedicated devtools:

```ts
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
```

You can also use TanStack Devtools as a unified panel for plugins (see `references/tanstack-devtools.md`).

## Common pitfalls

- Version mismatches between `@tanstack/react-router`, `@tanstack/router-plugin`, and devtools.
- Generated route tree missing/stale.
- Duplicate router packages installed in monorepos.

## Next references

- Start integration: `references/tanstack-start.md`
- Query integration: `references/tanstack-query.md`
- Devtools: `references/tanstack-devtools.md`
