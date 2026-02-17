# AGENTS.md

pullrequest.review is a Bitbucket and GitHub pull request review UI with a terminal-style interface focused on fast diff and file-tree navigation.

## Project Principles
- Keep the UI practical, compact, and keyboard-friendly.
- Preserve the terminal-inspired design language.
- Prefer simple, maintainable code over complex abstractions.
- Mobile-specific UX is a non-goal; optimize for desktop keyboard-first workflows.

## Technical Direction
- Use Bun only for dependency management and scripts.
- Keep the app client-first and avoid unnecessary server complexity.
- Prefer existing context/state patterns before introducing new globals.
- Keep git host integration host-agnostic where possible.
- Prefer TanStack DB collections + live queries for externally loaded app data.

## TanStack DB Architecture
- External host data is collection-driven.
- PR bundles, repo PR listings, and repository listings are defined in `src/lib/git-host/query-collections.ts`.
- Host data collections are RxDB-backed and persisted locally (with in-memory fallback if RxDB initialization fails).
- Collection accessors return scoped handles (`{ collection, utils }`) where:
  - `collection` is consumed by `useLiveQuery` (`@tanstack/react-db`)
  - `utils.refetch(...)` is used for stale-while-revalidate refreshes
  - `utils.lastError`/`utils.isFetching` are the canonical UI status signals
- Components read host data via `useLiveQuery` against the scoped `.collection` instead of ad-hoc `useQuery` calls in UI components.
- App bootstrap must initialize both settings storage and host-data storage (`ensureStorageReady()` + `ensureGitHostDataReady()`) before rendering data-dependent providers.
- To extend host data features, add/extend a collection in `src/lib/git-host/query-collections.ts` first, then consume it from UI with `useLiveQuery` and scoped collection utils.

## Persistence (RxDB-backed)
- App persistence uses a TanStack DB + RxDB-backed key/value layer in `src/lib/storage/client-storage-db.ts`.
- `src/lib/storage/versioned-local-storage.ts` is the storage API surface used by contexts/components/providers.
- Do not introduce direct `window.localStorage` usage in `src/`; route reads/writes through storage helpers.
- Settings/auth/view state keys use `makeVersionedStorageKey(...)`.
- Old storage keys/data are not read; storage is current-schema-only.
- To add persisted settings or UI state, add a new versioned key and keep all read/write logic inside the storage helpers or the owning context/provider.

## Host and Routing Conventions
- Bitbucket PR route: `/$workspace/$repo/pull-requests/$pullRequestId`.
- GitHub PR route: `/$workspace/$repo/pull/$pullRequestId`.
- Do not infer host from workspace memory. Route shape selects host.
- GitHub public PR read access should work without a token (subject to rate limits).
- GitHub write actions require authentication.

## Coding Conventions
- Use ASCII in source files.
- Keep components small and focused.
- Use memoization for provider/context values when needed to avoid avoidable re-renders.

## Validation
- Always run `bun run tsc` and `bun run check` after code changes.
- Always run `bun run knip` and fix all findings after code changes.
- Run `bun test` when touching data mappings, storage behavior, or keyboard/input handling logic.

## UI Conventions
- Monospaced-first typography.
- Sharp corners and clean panel structure.
- Consistent controls for settings, themes, and keyboard shortcuts.

## Naming
- Use `pullrequestdotreview` as the canonical project name when `pullrequest.review` cannot be used.
- Keep app-facing git host/domain models camelCase in `src/lib/git-host/types.ts` and map provider snake_case fields at provider boundaries.

## UI Component Anchors
- Use `data-component="<name>"` on shared layout and diff primitives.
- Keep names canonical and kebab-case.
- Prefer semantic HTML landmarks first (`nav`, `aside`, `header`, `main`), then use `data-component` for stable identification.

- `navbar`
- `sidebar`
- `top-sidebar`
- `search-sidebar`
- `summary-page`
- `summary-header` (PR title header in summary view)
- `diff-view` (primary content viewport below navbar and right of sidebar; hosts summary/settings/single-diff/list-diff views)
- `diff-list-view` (all file diffs container, multi-file stream)
- `diff-file-view` (single file diff container)
- `settings`
- `tree` (directory tree)

## Skills Workflow
- Before major refactors, read and apply:
- `./.agents/skills/vercel-react-best-practices/SKILL.md`
- `./.agents/skills/vercel-composition-patterns/SKILL.md`
- For TanStack data/router/query work, also read:
- `./.agents/skills/tanstack-suite/SKILL.md`
- When working in TanStack areas, consult the specific reference docs under `./.agents/skills/tanstack-suite/references/` (db/query/router/etc.) before implementing.
