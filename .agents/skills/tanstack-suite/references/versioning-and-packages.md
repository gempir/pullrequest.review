# Versioning and package map (TanStack suite)

This skill is primarily written for **React** projects (including **TanStack Start**). TanStack libraries are usually split into:

- **Core** packages (framework-agnostic)
- **Framework adapters** (React, Solid, Vue, Svelte, etc)
- **Devtools** packages (either dedicated per library or via TanStack Devtools plugins)

## Package matrix (React)

> Tip: when you’re unsure, run `scripts/tanstack-audit.mjs`.

### TanStack Start

- Scaffolding command (creates a project):
  - `npm create @tanstack/start@latest`
- Runtime packages (commonly present in Start apps):
  - `@tanstack/react-start`
  - `@tanstack/react-router`
  - `@tanstack/router-plugin` (bundler plugin; common in Vite setups)

### TanStack Router

- `@tanstack/react-router`
- `@tanstack/router-plugin` (Vite/other tooling plugin for file-based routing + route tree generation)
- Router devtools (dedicated):
  - `@tanstack/react-router-devtools`

### TanStack Query

- `@tanstack/react-query`
- Query devtools (dedicated):
  - `@tanstack/react-query-devtools`

### TanStack Table

- `@tanstack/react-table`

### TanStack DB

- Core: `@tanstack/db`
- React adapter: `@tanstack/react-db`
- Optional collection adapters (examples):
  - `@tanstack/query-db-collection` (Query-backed collections)
  - `@tanstack/rxdb-db-collection` (RxDB integration)

### TanStack Store

- Core: `@tanstack/store`
- React adapter: `@tanstack/react-store`

### TanStack Virtual

- `@tanstack/react-virtual`

### TanStack Pacer

- Core: `@tanstack/pacer`
- React adapter: `@tanstack/react-pacer`
- Pacer devtools plugin:
  - `@tanstack/react-pacer-devtools`

### TanStack Form

- `@tanstack/react-form`
- Optional integration helpers (examples):
  - `@tanstack/react-form-start` (Start/SSR helpers)
- Form devtools plugin:
  - `@tanstack/react-form-devtools`

### TanStack AI

- Core: `@tanstack/ai`
- React adapter: `@tanstack/ai-react`
- Provider adapters (examples):
  - `@tanstack/ai-openai`
  - `@tanstack/ai-anthropic`
  - `@tanstack/ai-gemini`
  - `@tanstack/ai-ollama`
  - (others exist; pick only what you use)
- AI devtools plugin:
  - `@tanstack/react-ai-devtools`

### TanStack Devtools

- React devtools host panel:
  - `@tanstack/react-devtools`
- Vite integration:
  - `@tanstack/devtools-vite`

## Version alignment rules of thumb

These are “don’t shoot yourself in the foot” rules that reduce surprise breakage.

### Router + Start: keep versions in sync

If you use Start, it’s common for these packages to be on the same version line:

- `@tanstack/react-start`
- `@tanstack/react-router`
- `@tanstack/router-plugin`
- `@tanstack/react-router-devtools`

If they drift, you can hit subtle build/runtime issues.

### Query + Query Devtools: keep major versions aligned

- Query v5 pairs with `@tanstack/react-query-devtools` v5.

Minor/patch mismatches usually work, but aligned versions are safer.

### TanStack Devtools host + plugins

- `@tanstack/react-devtools` is the host panel.
- Plugins (Form/Pacer/AI, etc.) can move independently, but staying within compatible ranges is recommended.

## Monorepo notes

In a monorepo:

- Prefer hoisted, single versions of TanStack packages where possible.
- Watch for duplicate copies via `pnpm why`, `npm ls`, or `yarn why`.
- Make sure devtools plugins are installed in the package where the app runs (not just a shared package).

