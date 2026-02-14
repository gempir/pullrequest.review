---
name: tanstack-suite
version: 1.0.0
description: "Expert-level TanStack Suite skill covering Start, Router, Query, Table, DB, Store, Virtual, Pacer, Form, AI, and Devtools. Provides architecture guidance, code patterns, audits, and best practices for modern React and full-stack apps."
author: TanStack Suite Skill
tags:
  - tanstack
  - react
  - fullstack
  - query
  - router
  - table
  - db
  - ai
  - devtools
---

# TanStack Suite Skill

Use this skill when you’re building or maintaining apps with the **TanStack ecosystem**, especially when you need:

- Correct **package selection** (core vs adapter vs devtools)
- **Version alignment** across related packages
- Correct **SSR/data-loading** and **hydration** behavior
- **Performance** best practices (tables, lists, routers)
- **Devtools** setup and debugging workflows

This skill covers:

- **TanStack Start** (full-stack React meta-framework)
- **TanStack Router** (type-safe routing)
- **TanStack Query** (async server-state)
- **TanStack Table** (headless tables/datagrids)
- **TanStack DB** (reactive client DB + sync)
- **TanStack Store** (signals-like reactive store)
- **TanStack Virtual** (virtualized lists/grids)
- **TanStack Pacer** (debounce/throttle/rate-limit/queue/batch utilities)
- **TanStack Form** (type-safe form state + validation)
- **TanStack AI** (type-safe AI SDK + tool calling + streaming)
- **TanStack Devtools** (unified devtools panel + plugins)

## How to use this skill

### 1) Identify the project archetype

Pick the closest archetype before writing code:

1. **TanStack Start app** (recommended when you control the full stack)
2. **React + Vite app** (add Router/Query/etc manually)
3. **Monorepo** (workspace version alignment is critical)

### 2) Run the audit scripts early

From the project root, run:

```bash
node path/to/skill/scripts/tanstack-audit.mjs
node path/to/skill/scripts/tanstack-usage-report.mjs
node path/to/skill/scripts/tanstack-router-plugin-check.mjs
node path/to/skill/scripts/tanstack-devtools-snippet.mjs
```

These scripts are **read-only** and help you quickly detect:

- Which TanStack packages are installed
- Common version-mismatch footguns
- Whether Router file-based generation is configured
- A ready-to-paste Devtools setup snippet based on installed plugins

### 3) Load the smallest relevant reference doc

This skill includes package-specific reference docs under `references/`. Load only what you need:

- `references/tanstack-start.md`
- `references/tanstack-router.md`
- `references/tanstack-query.md`
- `references/tanstack-table.md`
- `references/tanstack-db.md`
- `references/tanstack-store.md`
- `references/tanstack-virtual.md`
- `references/tanstack-pacer.md`
- `references/tanstack-form.md`
- `references/tanstack-ai.md`
- `references/tanstack-devtools.md`
- `references/versioning-and-packages.md`

## Operating principles

### Prefer official adapters + idiomatic patterns

- Prefer **framework adapters** (e.g. `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-table`) over lower-level core packages unless you’re authoring an adapter.
- Use **file-based routing** and **generated route trees** where supported; avoid hand-maintaining giant route configs.

### Keep versions aligned

Some TanStack package families are designed to move together.

- **Router + Start**: in many setups, `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-router-devtools`, and `@tanstack/react-start` should be kept on the **same version line**.
- **Query + devtools**: keep major versions aligned (e.g. Query v5 with `@tanstack/react-query-devtools`).

Use `scripts/tanstack-audit.mjs` to detect mismatches.

### SSR and data correctness first

- If using **TanStack Start**, treat **server-only code** as server-only (keys, secrets, DB credentials).
- For **Query**, ensure **prefetch + dehydrate/hydrate** is correct, and avoid double-fetching.
- For **Router**, prefer **loader/action** patterns for route-coupled data.

### Performance defaults

- Tables and virtual lists can become performance traps.
- Enforce stable references (memoize columns/data), use virtualization where appropriate, and avoid unnecessary rerenders.

### Devtools are part of the feature set

- Prefer the **TanStack Devtools unified panel** when possible.
- Otherwise use dedicated devtools (e.g. Query devtools component) and ensure dev-only loading.

## Common integration recipes

### Start + Router + Query baseline

- Use Router’s **route loaders** for route-coupled data needs.
- Use Query for cached async state and background refetching.
- In Start, consider preloading/prefetching queries in loaders and then dehydrating for the client.

### Store + Router context

- Use `@tanstack/react-store` for **small, app-wide reactive state** (auth state, UI preferences, feature flags).
- Prefer Router **route context** for values that are truly navigation-scoped.

### DB + Query

- Use DB for **local-first** reads/writes and live queries.
- Sync to server via the collection’s mutation hooks/handlers.
- Consider DB-backed collections that plug into Query for cache coherence.

### Table + Query + Virtual

- Use Query to fetch server-side paginated/sorted data.
- Use Table for column/sorting/filtering state.
- Use Virtual for rendering only visible rows (especially > 200 rows).

### Pacer + Query for debounced/throttled fetching

- Use Pacer when you need stable, testable debouncing/throttling primitives.
- Typical examples: typeahead search, scroll/resize handlers, rate-limited mutation bursts.

### Form + Query

- Use Form for local form state.
- Use Query mutations for server writes (or Start server functions).
- Keep server validation canonical; client validation is UX.

### Form + Start/Router

- Prefer Start **server functions** or Router **actions**.
- Keep secrets on the server.
- Return structured errors that map cleanly to field errors.

### AI + Start

- Keep provider keys on the server.
- Stream responses (SSE) to clients.
- Use tool definitions with schema validation.

### Devtools (unified)

- Use `@tanstack/react-devtools` + plugin packages when available.
- Keep devtools dev-only unless you explicitly need production debugging.

## What “done” looks like

When implementing TanStack features, consider the work complete only when:

- ✅ Dependencies are correct and versions are aligned
- ✅ TypeScript types are clean (no `any` escapes unless justified)
- ✅ SSR/hydration path is correct (no double fetch, no hydration warnings)
- ✅ Devtools integration exists (dev-only) for the relevant libs
- ✅ Performance hazards are addressed (virtualization where needed)
- ✅ There is a small, realistic example route/component proving the feature

## Troubleshooting checklist

When something is broken, check in this order:

1. **Versions**: run `scripts/tanstack-audit.mjs` and fix mismatches.
2. **Devtools**: if available, use them to inspect Router/Query/Form/Pacer/AI state.
3. **SSR/hydration**: confirm server and client render match; verify Query hydration and Router loaders.
4. **Duped packages**: ensure there is only one installed copy of key packages (common in monorepos).
5. **Bundler config**: ensure Router plugin/devtools integrations are in the correct place (e.g. Vite plugins order).

## What this skill does not do

- It does **not** replace TanStack documentation.
- It does **not** assume your exact framework unless you tell it (Start vs plain React).
- It does **not** run network operations by default.

## Quick index

- Start: `references/tanstack-start.md`
- Router: `references/tanstack-router.md`
- Query: `references/tanstack-query.md`
- Table: `references/tanstack-table.md`
- DB: `references/tanstack-db.md`
- Store: `references/tanstack-store.md`
- Virtual: `references/tanstack-virtual.md`
- Pacer: `references/tanstack-pacer.md`
- Form: `references/tanstack-form.md`
- AI: `references/tanstack-ai.md`
- Devtools: `references/tanstack-devtools.md`
- Versioning/package map: `references/versioning-and-packages.md`
