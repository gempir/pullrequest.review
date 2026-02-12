# AGENTS.md

This project is a PR review UI with Bitbucket Cloud OAuth. It renders diffs and a file tree for Bitbucket pull requests with a terminal-inspired design.

## Stack
- Vite + React + TypeScript
- TanStack Router/Start + React Query
- Diff rendering: `@pierre/diffs`
- UI components in `src/components/ui`
- Design: Terminal-inspired, monospaced (JetBrains Mono), dark theme with defined borders

## Key flows
- OAuth + token persistence + refresh: `src/lib/bitbucket-oauth.ts`, `src/lib/pr-context.tsx`, `src/routes/oauth/callback.tsx`
- Onboarding + repo selection: `src/routes/__root.tsx`
- PR input + PR list landing: `src/routes/index.tsx`
- Bitbucket API fetch + diff parsing: `src/routes/index.tsx`
- File tree data model: `src/lib/file-tree-context.tsx`
- File tree UI: `src/components/file-tree.tsx`
- Diff anchors: `src/lib/file-anchors.ts`
- Settings popup with diff options: `src/components/settings-menu.tsx`
- Keyboard shortcuts: `src/lib/shortcuts-context.tsx`

## Bitbucket Cloud integration
- Accepts PR URL: `https://bitbucket.org/<workspace>/<repo>/pull-requests/<id>`
- Fetches:
  - `GET https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests/<id>/diff`
  - `GET https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests/<id>/diffstat?pagelen=100`
- Repository listing:
  - `GET https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100`
- PR list per repo:
  - `GET https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests?pagelen=20`

## OAuth setup
- OAuth endpoints:
  - `https://bitbucket.org/site/oauth2/authorize`
  - `https://bitbucket.org/site/oauth2/access_token`
- Required env:
  - `VITE_BITBUCKET_CLIENT_ID` (client/public)
  - `BITBUCKET_CLIENT_SECRET` (server)
- Callback route:
  - `http://localhost:3000/oauth/callback` (adjust to your dev origin)

## Local storage keys
- OAuth tokens: `bitbucket_oauth`
- Selected repos: `bitbucket_repos`
- OAuth state: `bitbucket_oauth_state`
- Keyboard shortcuts: `pr_review_shortcuts`

## Design System
- Monospaced font: JetBrains Mono
- Dark theme: Near-black backgrounds (#0a0a0a, #111111) with subtle borders (#2a2a2a)
- Sharp corners: 2px border radius maximum
- Terminal aesthetic: Clean panels, minimal rounding, computer-focused
- Status colors: Green (#22c55e) for added, Red (#ef4444) for removed, Yellow (#eab308) for modified

## Settings & Shortcuts
- Settings accessed via "Settings" button in header
- Diff options moved to settings popup with tabbed interface
- Keyboard shortcuts configurable in settings:
  - Default: `j` = Next file, `k` = Previous file
  - Supports modifier keys (Ctrl, Alt, Shift, Cmd)
  - Persisted to localStorage
- File navigation works globally (j/k keys scroll to file in diff view)

## Conventions and notes
- Use ASCII in source files.
- No nested bullet lists in responses.
- Use Bun only for dependency management and scripts. Do not use npm, yarn, or pnpm.
- Use `pullrequestdotreview` as the canonical name of the project when pullrequest.review is not possible
- Prefer existing contexts (`pr-context`, `file-tree-context`, `shortcuts-context`) over adding new global state.
- Wrap context provider values in `useMemo` to prevent unnecessary re-renders.
- `ScrollArea` from Radix is currently avoided due to a render loop; use simple `div` + `overflow-auto` for now.
- Dialog animations removed from Radix Dialog to prevent infinite loop issues.

## Suggested next upgrades
- Add PR state badges and sorting on the landing list.
- Store selected repos in a small settings panel to edit later.
- Add PR metadata (title, author, status) in the header/sidebar of the diff view.
- Filter diff view by selected file (optional).
