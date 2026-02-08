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
- PR input + auth state: `src/lib/pr-context.tsx`
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
- Optional Basic auth via username/email + app password (set in header UI). See `encodeBasicAuth` in `src/routes/index.tsx`.

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
- Support OAuth / bearer token auth (in addition to Basic).
- Show PR metadata (title, author, status) in the header or sidebar.
- Filter diff view by selected file (optional).
