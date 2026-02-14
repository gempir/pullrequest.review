/**
 * QueryClient setup snippets.
 *
 * Important:
 * - In SSR environments, create a fresh QueryClient PER REQUEST on the server.
 * - In the browser, you can usually share a singleton QueryClient.
 */

import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getBrowserQueryClient() {
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
