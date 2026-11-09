# AGENTS.md

pullrequest.review is a Bitbucket and GitHub pull request review UI with a terminal-style interface focused on fast diff and file-tree navigation.

## Project Principles
- Keep the UI practical, compact, and keyboard-friendly.
- Prefer simple, maintainable code over complex abstractions.
- Mobile-specific UX is a non-goal; optimize for desktop keyboard-first workflows.

## Technical Direction
- Use Bun only for dependency management and scripts.
- Keep the app client-first and avoid unnecessary server complexity.
- Prefer existing context/state patterns before introducing new globals.
- Keep git host integration host-agnostic where possible.
- Use TanStack Query for externally loaded app data.

## Host Data
- Host data is server state owned by TanStack Query. Add query definitions to `src/lib/git-host/queries.ts` and read them with `useQuery`/`useQueries`.
- Mutations go through `getHostClient(host)` and refetch the affected query on success.
- The query client does not retry and does not refetch on focus, because host APIs are rate limited.
- Pull request loading has two stages: a critical query (pull request, diff, commits), then in parallel a comments query and a deferred query (history, reviewers, builds, current user). Comment mutations refetch only the comments query.

## Persistence
- `src/lib/storage.ts` is the only persistence API. It is a small key/value store over IndexedDB (`idb-keyval`), cached in memory so reads stay synchronous, and synced between tabs with `BroadcastChannel`.
- Do not use `window.localStorage` in `src/`.
- `ensureStorageReady()` must resolve before reading persisted values.
- Storage is current-schema-only: old data is not migrated. Review state expires after 30 days; settings and credentials do not.
- To persist something new, add a typed read/write pair to `src/lib/storage.ts`.

## Review Page Structure
- `src/features/review/hooks/use-review-controller.ts` composes the focused hooks and is exposed to views through `useReview()` in `components/review-context.ts`. Add new logic to a focused hook, not to the controller.
- View components read `useReview()` instead of receiving long prop lists. `ThreadCard`, `PullRequestSummaryPanel`, and `ReviewTopNavbar` stay prop-driven so they can be rendered in tests.
- Pure logic belongs in `src/features/review/model/`.
- Provider code is split into `api.ts` (auth, requests), `raw-types.ts`, `mappers.ts` (snake_case to app models), and `client.ts`.

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
- Run `bun run tsc`, `bun run check`, `bun run knip`, `bun test`, `bun run react-doctor`, and `bun run build` after making changes. CI runs the same checks.

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
