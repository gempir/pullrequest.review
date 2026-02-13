# AGENTS.md

pullrequest.review is a Bitbucket and GitHub pull request review UI with a terminal-style interface focused on fast diff and file-tree navigation.

## Project Principles
- Keep the UI practical, compact, and keyboard-friendly.
- Preserve the terminal-inspired design language.
- Prefer simple, maintainable code over complex abstractions.

## Technical Direction
- Use Bun only for dependency management and scripts.
- Keep the app client-first and avoid unnecessary server complexity.
- Prefer existing context/state patterns before introducing new globals.
- Keep git host integration host-agnostic where possible.

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

## UI Conventions
- Monospaced-first typography.
- Sharp corners and clean panel structure.
- Consistent controls for settings, themes, and keyboard shortcuts.

## Naming
- Use `pullrequestdotreview` as the canonical project name when `pullrequest.review` cannot be used.
