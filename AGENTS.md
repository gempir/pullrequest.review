# AGENTS.md

pullrequest.review is a Bitbucket pull request review UI with a terminal-style interface focused on fast diff and file-tree navigation.

## Project Principles
- Keep the UI practical, compact, and keyboard-friendly.
- Preserve the terminal-inspired design language.
- Prefer simple, maintainable code over complex abstractions.

## Technical Direction
- Use Bun only for dependency management and scripts.
- Keep the app client-first and avoid unnecessary server complexity.
- Prefer existing context/state patterns before introducing new globals.

## Coding Conventions
- Use ASCII in source files.
- Keep components small and focused.
- Use memoization for provider/context values when needed to avoid avoidable re-renders.

## UI Conventions
- Monospaced-first typography.
- Sharp corners and clean panel structure.
- Consistent controls for settings, themes, and keyboard shortcuts.

## Naming
- Use `pullrequestdotreview` as the canonical project name when `pullrequest.review` cannot be used.
