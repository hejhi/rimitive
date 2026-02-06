# Worker Pre-rendering Example

A PWA that demonstrates **client-side pre-rendering** using Web Workers. The worker acts as a local SSR server — rendering pages to HTML with the parse5 adapter — while the main thread hydrates and attaches interactivity. No server required.

## What This Shows

- **Worker as local SSR** — same components render in a Web Worker (parse5) and hydrate on the main thread (DOM), thanks to Rimitive's adapter abstraction
- **Offline-first data** — IndexedDB persistence with a `cache(route, fetcher, render)` primitive — data is always available, no loading states
- **View Transitions** — native page transitions via the View Transitions API
- **Optimistic updates** — UI updates immediately, mutations + cache invalidation happen in the background
- **Cache invalidation** — after mutations, the worker re-renders affected routes proactively

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Main Thread                                                  │
│                                                               │
│  ┌─────────┐  pathname change   ┌──────────────────────────┐  │
│  │ Router  │───────────────────►│ Render cycle:            │  │
│  └─────────┘                    │ 1. workerApi.prerender() │  │
│       ▲                         │ 2. createHydrateRegion() │  │
│       │ popstate                │ 3. renderPage() + attach │  │
│       │                         └──────────────────────────┘  │
│                                          │                    │
└──────────────────────────────────────────┼────────────────────┘
                                           │ Comlink RPC
                                           ▼
┌───────────────────────────────────────────────────────────────┐
│   Web Worker                                                  │
│                                                               │
│   ┌──────────────────┐      ┌─────────────────────────────┐   │
│   │  Parse5 Adapter  │─────►│  renderToString(spec, ser)  │   │
│   │  (No DOM needed) │      │  Returns { html, renderTime}│   │
│   └──────────────────┘      └─────────────────────────────┘   │
│                                                               │
│   prerender(route) → fresh service → match route → render     │
│   invalidate(route) → clear cache → re-prerender              │
└───────────────────────────────────────────────────────────────┘
```

### Navigation Flow

1. Router detects pathname change
2. Main thread calls `workerApi.prerender(route)` via Comlink
3. Worker creates a fresh service with parse5 adapter, renders the matched page to HTML
4. Main thread receives HTML, creates a hydration region (detached DOM parse → adapter setup)
5. Same page component runs on the main thread, attaching to existing DOM nodes
6. `attach()` inserts the tree into the document and switches to live DOM mode
7. View Transition API animates the swap (if not initial load)

### Mutation Flow

1. User action → component updates local signal immediately (optimistic)
2. Action performs IndexedDB mutation
3. Action calls `workerApi.invalidate(route)` — worker clears cache and re-prerenders
4. Next navigation to that route gets fresh HTML instantly

## Project Structure

```
src/
├── main.ts              # Main thread — router, navigation, hydration orchestration
├── worker.ts            # Web Worker — pre-renders pages with parse5 + Comlink
├── worker-api.ts        # Shared types for worker RPC
├── routes.ts            # Route configuration (shared between worker and main)
├── data.ts              # IndexedDB data layer (todo domain CRUD)
├── actions.ts           # Mutation actions with cache invalidation
│
├── pwa/                 # ← Reusable utilities (copy into your project)
│   ├── cache.ts         # DataCacheModule — IndexedDB data cache with cache() primitive
│   ├── hydrate.ts       # createHydrateRegion — parse HTML, create hydration adapter, attach
│   ├── status.ts        # createStatus — reactive loading indicator
│   └── index.ts         # Re-exports
│
├── pages/
│   ├── types.ts         # PageService — minimal interface pages require
│   ├── index.ts         # Route-to-component map + renderPage()
│   ├── HomePage.ts      # List of todo lists
│   └── DetailPage.ts    # Single list with items
│
└── components/
    ├── ListCard.ts      # Clickable list card
    ├── TodoItem.ts      # Checkbox + delete
    ├── NewListForm.ts   # Create list form with color picker
    ├── AddItemForm.ts   # Add todo input
    └── EmptyState.ts    # Empty state message
```

## The `pwa/` Directory

The `pwa/` folder contains **self-contained utilities** for building offline-first PWAs with Rimitive (patterns you can re-use in your own projects). They depend only on `@rimitive/*` packages and don't contain any business logic.

### cache.ts — Data Cache

A `cache(route, fetcher, render)` primitive for local-first apps. Like `load()` but data is always available — no loading states needed.

```typescript
const svc = compose(
  // ...base modules
  DataCacheModule.with({ dbName: 'my-app', storeName: 'data' })
);

// In a page component — cache handles get-or-fetch
return svc.cache(
  '/list/123',
  async () => ({ items: await getItems('123') }),
  (data) => div(map(signal(data.items), ...))
);
```

### hydrate.ts — Hydration Region

Parses pre-rendered HTML into a detached DOM tree, sets up hydration adapters, and provides an `attach()` to insert into the document. Separating parse from attach gives you control over timing (useful for view transitions).

```typescript
const { service, attach } = await createHydrateRegion({
  container: app,
  html: '<div class="page">...</div>',
  service: baseService,
});

// Run component against hydrated DOM
MyPage(service)(data).create(service);

// Insert into document + switch to live DOM mode
attach();
```

### status.ts — Status Indicator

Signal-based status that syncs to a DOM element.

```typescript
const status = createStatus({ signal, effect }, { element: '#status' });
status('loading');
// ...
status('ready');
```

## Running

```bash
pnpm install
pnpm --filter @rimitive/example-offline-ssr dev
```
