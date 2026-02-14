# TanStack Virtual

Official docs: https://tanstack.com/virtual/latest

TanStack Virtual is a **headless virtualization** engine for lists/grids/tables.

Use it when you need to render large collections while keeping DOM nodes low (smooth 60fps scrolling).

## Install (React)

```bash
npm i @tanstack/react-virtual
```

## Core concept

You give Virtual:

- The number of items (`count`)
- A scroll element (`getScrollElement`)
- An estimated item size (`estimateSize`)

Virtual returns:

- The list of items that should be rendered (`getVirtualItems()`)
- Total size to set on the inner container (`getTotalSize()`)

## Basic list example

```tsx
import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualList({ items }: { items: string[] }) {
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  })

  return (
    <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Dynamic row heights

If items have variable height:

- Use `measureElement` (or the adapter’s measuring options)
- Avoid expensive reflows; keep row content stable

## Virtualizing tables

Typical pattern:

- Render the header normally
- Virtualize the `<tbody>` rows
- Keep column widths stable

Combine with Table:

- `table.getRowModel().rows` gives you the row list
- Virtual decides which of those rows to render

See: `references/tanstack-table.md`

## Infinite scrolling

Combine with Query:

- Use `useInfiniteQuery`
- When the last virtual item is near the end, call `fetchNextPage()`

## Common pitfalls

- Forgetting to set the inner container’s height (`getTotalSize()`)
- Rendering too many items (overscan too large)
- Unstable row keys

## Next references

- Table: `references/tanstack-table.md`
- Query: `references/tanstack-query.md`
