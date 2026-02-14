# TanStack Store

Official docs: https://tanstack.com/store/latest

TanStack Store is an **immutable, reactive store** (signals-like) with framework adapters.

Use it for:

- Small amounts of app-wide reactive state (auth/session UI state, feature flags)
- Building blocks for other TanStack libraries
- Cases where you want fine-grained updates without adopting a heavier state library

Avoid using it as a dumping ground for everything; keep “server state” in Query and “form state” in Form.

## Install (React)

```bash
npm i @tanstack/react-store
```

## Basic usage

```tsx
import { Store, useStore } from '@tanstack/react-store'

export const counterStore = new Store({ count: 0 })

export function Counter() {
  const state = useStore(counterStore)
  return (
    <div>
      <div>Count: {state.count}</div>
      <button
        onClick={() =>
          counterStore.setState((prev) => ({ ...prev, count: prev.count + 1 }))
        }
      >
        Increment
      </button>
    </div>
  )
}
```

## Updating patterns

- Use functional updates (`setState(prev => next)`) to avoid stale closures.
- Keep updates immutable.
- Prefer smaller stores with clear ownership over one giant store.

## Derived state

For computed values:

- Prefer derived stores/selectors where available.
- Avoid recomputing expensive derived state on every render.

## Integration patterns

### Store + Router

- Put stable app services (auth, feature flags) in Store.
- Inject them into Router context so loaders/actions can use them.

### Store + Form

- Form should own form state.
- Store should not mirror form state unless you truly need cross-route persistence.

### Store + Query

- Avoid putting Query data into Store.
- If you need a “selectedId” or UI preference, Store is fine.

## Common pitfalls

- Using Store as a replacement for Query.
- Creating new Store instances inside components (should be module-level or memoized).

## Next references

- Router: `references/tanstack-router.md`
- Query: `references/tanstack-query.md`
- Form: `references/tanstack-form.md`
