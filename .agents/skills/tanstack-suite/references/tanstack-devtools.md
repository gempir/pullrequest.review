# TanStack Devtools

Official docs: https://tanstack.com/devtools/latest

TanStack Devtools is a **unified devtools host panel** for inspecting TanStack libraries via plugins.

You can think of it as:

- **Host panel**: `TanStackDevtools` (framework-specific)
- **Plugins**: Form/Pacer/AI/etc plugins that register panels
- **Event bus**: optional connection to server-side observability

This file covers the modern TanStack Devtools approach *and* where to still use dedicated devtools (Query, Router).

## Install (React)

```bash
npm i -D @tanstack/react-devtools
```

Optional (Vite)

```bash
npm i -D @tanstack/devtools-vite
```

## Add plugins

Install the plugins you need:

```bash
npm i -D @tanstack/react-form-devtools @tanstack/react-pacer-devtools @tanstack/react-ai-devtools
```

## Usage (React)

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools'
import { pacerDevtoolsPlugin } from '@tanstack/react-pacer-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'

export function Devtools() {
  if (import.meta.env.PROD) return null
  return (
    <TanStackDevtools
      plugins={[formDevtoolsPlugin(), pacerDevtoolsPlugin(), aiDevtoolsPlugin()]}
      eventBusConfig={{
        // AI plugin often needs this when you have a server event bus available
        connectToServerBus: true,
      }}
    />
  )
}
```

## Dedicated devtools you may still use

Some libraries still commonly use dedicated devtools packages/components.

### Query Devtools

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryDevtools() {
  if (import.meta.env.PROD) return null
  return <ReactQueryDevtools initialIsOpen={false} />
}
```

### Router Devtools

```tsx
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export function RouterDevtools() {
  if (import.meta.env.PROD) return null
  return <TanStackRouterDevtools />
}
```

## Production builds

Many TanStack Devtools plugins are **no-ops in production** when imported from their default entry.

If you explicitly need production debugging:

- Look for `/production` exports (example from Pacer: `@tanstack/react-pacer-devtools/production`)
- Gate rendering behind a feature flag so you can enable it safely

## Troubleshooting

- If plugins don’t appear, confirm they’re installed and you’re passing `plugins={[...plugin()]}`.
- If server connection features don’t work, ensure your app has the corresponding server event bus configured and that you’re passing `eventBusConfig`.
- If devtools break after upgrading, check version alignment.

## Next references

- Form devtools: `references/tanstack-form.md`
- Pacer devtools: `references/tanstack-pacer.md`
- AI devtools: `references/tanstack-ai.md`
