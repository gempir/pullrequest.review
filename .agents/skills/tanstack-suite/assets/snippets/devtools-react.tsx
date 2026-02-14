/**
 * Devtools example (React):
 * - TanStack Devtools host + plugins (Form, Pacer, AI)
 * - Dedicated devtools for Query + Router (optional)
 *
 * NOTE: import.meta.env.PROD is Vite-style; adjust for your bundler.
 */

import * as React from 'react'

// TanStack Devtools host + plugins
import { TanStackDevtools } from '@tanstack/react-devtools'
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools'
import { pacerDevtoolsPlugin } from '@tanstack/react-pacer-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'

// Dedicated devtools (optional)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export function Devtools() {
  if (import.meta.env.PROD) return null

  return (
    <>
      <TanStackDevtools
        plugins={[formDevtoolsPlugin(), pacerDevtoolsPlugin(), aiDevtoolsPlugin()]}
        eventBusConfig={{
          // AI plugin commonly needs this when your server exposes an event bus
          connectToServerBus: true,
        }}
      />

      {/* Optional dedicated panels */}
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackRouterDevtools />
    </>
  )
}
