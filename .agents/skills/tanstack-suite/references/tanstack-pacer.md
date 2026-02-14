# TanStack Pacer

Official docs: https://tanstack.com/pacer/latest

TanStack Pacer provides **battle-tested pacing primitives**:

- Debounce
- Throttle
- Rate limit
- Queue
- Batch

…with both **core utilities** and **React hooks**.

Use Pacer when you want pacing logic that is:

- Reusable and testable
- Observable (devtools integration)
- Safer than ad-hoc `setTimeout` logic

## Install (React)

```bash
npm i @tanstack/react-pacer
```

If you’re using core utilities without React:

```bash
npm i @tanstack/pacer
```

## Debouncing (React)

Typical “typeahead search” pattern:

- Use debounced input value
- Use that in your Query key

```tsx
import * as React from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useQuery } from '@tanstack/react-query'

export function SearchBox() {
  const [text, setText] = React.useState('')
  const debouncedText = useDebouncedValue(text, { wait: 250 })

  const results = useQuery({
    queryKey: ['search', debouncedText],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(debouncedText)}`).then(r => r.json()),
    enabled: debouncedText.length > 0,
  })

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {results.isFetching ? 'Searching…' : null}
    </div>
  )
}
```

## Throttling

Use throttling for high-frequency signals (scroll, resize, mouse move) where you want a max update rate.

## Rate limiting / queuing / batching

These are useful for:

- Preventing mutation bursts
- Controlling concurrency (queue)
- Sending grouped requests (batch)

## Devtools

Pacer integrates with **TanStack Devtools** via a plugin.

Install:

```bash
npm i @tanstack/react-devtools @tanstack/react-pacer-devtools
```

Then:

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { pacerDevtoolsPlugin } from '@tanstack/react-pacer-devtools'

export function Devtools() {
  if (import.meta.env.PROD) return null
  return <TanStackDevtools plugins={[pacerDevtoolsPlugin()]} />
}
```

### Registering utilities

Many Pacer utilities only show in devtools when you provide a `key` option.

## Next references

- Query integration: `references/tanstack-query.md`
- Devtools host panel: `references/tanstack-devtools.md`
