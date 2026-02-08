# AGENTS.md

This project is a PR review UI with Bitbucket Cloud OAuth. It renders diffs and a file tree for Bitbucket pull requests and supports selecting multiple repositories.

## Stack
- Vite + React + TypeScript
- TanStack Router/Start + React Query
- Diff rendering: `@pierre/diffs`
- UI components in `src/components/ui`

## Must-run build
Always run after changes:
- `bun run build`

## Key flows
- OAuth + token persistence + refresh: `src/lib/bitbucket-oauth.ts`, `src/lib/pr-context.tsx`, `src/routes/oauth/callback.tsx`
- Onboarding + repo selection: `src/routes/__root.tsx`
- PR input + PR list landing: `src/routes/index.tsx`
- Bitbucket API fetch + diff parsing: `src/routes/index.tsx`
- File tree data model: `src/lib/file-tree-context.tsx`
- File tree UI: `src/components/file-tree.tsx`
- Diff anchors: `src/lib/file-anchors.ts`

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
  - `BITBUCKET_CLIENT_ID` is optional (server) and can fall back to `VITE_BITBUCKET_CLIENT_ID`.
- Callback route:
  - `http://localhost:3000/oauth/callback` (adjust to your dev origin)

## Local storage keys
- OAuth tokens: `bitbucket_oauth`
- Selected repos: `bitbucket_repos`
- OAuth state: `bitbucket_oauth_state`

## Conventions and notes
- Use ASCII in source files.
- No nested bullet lists in responses.
- Prefer existing contexts (`pr-context`, `file-tree-context`) over adding new global state.
- `ScrollArea` from Radix is currently avoided due to a render loop; use simple `div` + `overflow-auto` for now.

## Suggested next upgrades
- Add PR state badges and sorting on the landing list.
- Store selected repos in a small settings panel to edit later.
- Add PR metadata (title, author, status) in the header/sidebar of the diff view.
- Filter diff view by selected file (optional).
