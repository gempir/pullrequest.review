/**
 * Conceptual example: TanStack Table + TanStack Virtual.
 *
 * This is NOT a drop-in component; it shows the idea:
 * - Table computes the row model
 * - Virtual decides which of those rows to render
 */

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

type Row = { id: string; name: string }

export function VirtualizedTable({ data }: { data: Row[] }) {
  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [{ accessorKey: 'name', header: 'Name' }],
    [],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const parentRef = React.useRef<HTMLDivElement | null>(null)
  const rows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  })

  return (
    <div>
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
      </table>

      <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index]
            return (
              <div
                key={v.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <table>
                  <tbody>
                    <tr>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
