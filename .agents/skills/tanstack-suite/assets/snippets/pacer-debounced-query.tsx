import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@tanstack/react-pacer'

export function DebouncedSearch() {
  const [q, setQ] = React.useState('')
  const debounced = useDebouncedValue(q, { wait: 250 })

  const query = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(debounced)}`).then((r) => r.json()),
    enabled: debounced.length > 0,
  })

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
      {query.isFetching ? <div>Searching…</div> : null}
    </div>
  )
}
