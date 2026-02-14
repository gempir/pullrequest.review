# TanStack Table

Official docs: https://tanstack.com/table/latest

TanStack Table is a **headless** table/datagrid engine.

Use it when you need:

- Sorting, filtering, grouping, aggregation
- Column visibility / resizing / pinning
- Row selection
- Client-side or server-side pagination
- Tight TypeScript typing for row models and columns

This reference focuses on **React Table v8**.

## Install (React)

```bash
npm i @tanstack/react-table
```

## Mental model

TanStack Table gives you:

- A *state machine* for table features (sorting, filtering, pagination…)
- A *row model* pipeline (core -> filtered -> sorted -> paginated -> …)
- Rendering helpers (`getHeaderGroups`, `getRowModel`) but **no UI**

## Basic setup

```tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

type Person = { id: string; name: string; age: number }

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
]

export function PeopleTable({ data }: { data: Person[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id}>
                {h.isPlaceholder
                  ? null
                  : flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

## Sorting / filtering / pagination

Table features are enabled by:

1. Adding the relevant row model functions (e.g. `getSortedRowModel`)
2. Wiring the relevant state (controlled or uncontrolled)

Server-side patterns:

- Treat Table state as the source of truth for sort/filter/page state
- Feed that state into Query keys
- Fetch server data accordingly

## Table + Query (server-side)

Pattern:

- Table state: `{ sorting, columnFilters, pagination }`
- Query key includes the state
- Query function requests server data

Example key:

```ts
['people', { sorting, filters, pageIndex, pageSize }]
```

## Table + Virtual

For large row counts, virtualize:

- Render only visible rows (and measure row heights if needed)
- Keep header rendering stable
- Avoid re-creating `columns`/`data` every render

See: `references/tanstack-virtual.md`

## Performance checklist

- Memoize `columns` (e.g. `useMemo`) unless truly static
- Use stable `data` references
- Avoid expensive cell renderers; compute outside render when possible
- Virtualize when rows > ~200 or when cell renderers are heavy

## Common pitfalls

- Recreating `columns` inline -> causes rerenders and state resets
- Doing server-side pagination but also enabling client-side row models
- Over-rendering (tables can be expensive even if the data set is small)

## Next references

- Virtual: `references/tanstack-virtual.md`
- Query: `references/tanstack-query.md`
