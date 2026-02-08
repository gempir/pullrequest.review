# AGENTS.md

This project is a PR review UI. It currently integrates with Bitbucket Cloud PRs and renders diffs + a file tree based on Bitbucket `diff` and `diffstat`.

## Stack
- Vite + React + TypeScript
- TanStack Router/Start + React Query
- Diff rendering: `@pierre/diffs`
- UI components in `src/components/ui`

## Must-run build
Always run after changes:
- `bun run build`

## Key flows
- Onboarding + auth + repo selection: `src/lib/pr-context.tsx`, `src/routes/__root.tsx`
- PR input + PR list landing: `src/routes/index.tsx`
- Bitbucket API fetch + diff parsing: `src/routes/index.tsx`
- File tree data model: `src/lib/file-tree-context.tsx`
- File tree UI: `src/components/file-tree.tsx`
- Diff viewer layout + anchors: `src/routes/index.tsx`, `src/lib/file-anchors.ts`
- App shell and header inputs: `src/routes/__root.tsx`

## Bitbucket Cloud integration
- Accepts PR URL: `https://bitbucket.org/<workspace>/<repo>/pull-requests/<id>`
- Fetches:
  - `GET https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests/<id>/diff`
  - `GET https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pullrequests/<id>/diffstat?pagelen=100`
- Optional Bearer auth via API token (set in onboarding UI).
- Repository listing: `GET https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100`

## File tree + diff linking
- File tree is built from `diffstat` paths. Change kinds are derived from `diffstat.status`.
- Clicking a file tree entry scrolls to a diff anchor: `fileAnchorId(path)`.
- The file tree expects file paths to be normalized with forward slashes.

## Conventions and notes
- Use ASCII in source files.
- No nested bullet lists in responses.
- For new features, prefer wiring through the existing contexts rather than adding global state.
- If you change API calls, keep the parsing and error handling in `src/routes/index.tsx` consistent.

## Suggested next upgrades
- Support listing the user's pull requests on the landing page.
- Show PR metadata (title, author, status) in the header or sidebar.
- Filter diff view by selected file (optional).
