import * as React from 'react'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'

export interface RouterContext {
  // Add things that loaders/actions need access to:
  // queryClient: QueryClient
  // auth: { user?: User; isAuthenticated: boolean }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
})

function Root() {
  return (
    <div>
      <nav>
        <Link to="/" activeOptions={{ exact: true }}>
          Home
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}
