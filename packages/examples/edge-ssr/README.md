# Edge SSR Example

Full Rimitive SSR running on Cloudflare Workers with streaming and client hydration.

## The `edge/` Directory

The `edge/` folder contains **copy-able utilities** for building edge-rendered apps. These are patterns, not a framework - copy them into your project and modify as needed.

```
src/edge/
├── html.ts       # HTML document template utilities
├── response.ts   # Response helpers for basic and streaming SSR
├── hydrate.ts    # Client-side hydration utilities
└── index.ts      # Barrel export
```

### Server (Worker)

```typescript
import { renderToResponse, renderToStreamingResponse } from './edge';

// Basic SSR - no async boundaries
return renderToResponse('/about', {
  title: 'About Us',
  styles: myStyles,
  createService,
  createApp: (svc) => App(svc),
});

// Streaming SSR - with load() boundaries
return renderToStreamingResponse('/dashboard', {
  title: 'Dashboard',
  streamKey: '__APP_STREAM__',
  styles: myStyles,
  createService,
  createApp: (svc) => App(svc),
});
```

### Client

```typescript
import { hydrateApp } from './edge';

hydrateApp({
  rootSelector: '.container',  // Must match what App creates!
  streamKey: '__APP_STREAM__',
  createService,
  createApp: (svc) => App(svc),
});
```

## What This Proves

- **Full SSR at the edge** - Same rendering on edge and client
- **Streaming SSR** - Shell sent immediately, data streams as it resolves
- **Client hydration** - Server HTML becomes interactive without re-render
- **SPA navigation** - Client-side routing after initial load
- **Zero Node.js** - Runs in any JS runtime (Workers, Deno, Bun)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home page - basic SSR |
| `/streaming` | Streaming demo - async boundaries with staggered data |

## Running Locally

```bash
pnpm install
pnpm --filter @rimitive/example-edge-ssr dev
```

Visit http://localhost:8787

## Deploying to Cloudflare

```bash
pnpm --filter @rimitive/example-edge-ssr deploy
```

## Project Structure

```
src/
├── edge/            # ← Copy-able utilities
│   ├── html.ts       # HTML template
│   ├── response.ts   # renderToResponse, renderToStreamingResponse
│   ├── hydrate.ts    # hydrateApp
│   └── index.ts
│
├── worker.ts        # CF Worker entry
├── client.ts        # Browser entry
├── service.ts       # Shared service factory
├── App.ts           # Main app with routing
├── routes.ts        # Route definitions
├── config.ts        # Shared config
├── styles.ts        # CSS
└── pages/
    ├── HomePage.ts
    └── StreamingPage.ts
```

## How Streaming Works

```
Browser                          Worker
   │                               │
   │──── GET /streaming ──────────►│
   │                               │
   │◄─── Initial HTML + shell ─────│  (immediate)
   │     with loading states       │
   │                               │
   │◄─── <script>push("quick")────│  (~300ms)
   │                               │
   │◄─── <script>push("detail")───│  (~800ms)
   │                               │
   │◄─── </html> ─────────────────│
   │                               │
```

## How Hydration Works

1. Server renders HTML with fragment markers
2. Client creates hydration adapter (walks existing DOM)
3. Same App component runs - wires reactivity to existing nodes
4. `adapter.activate()` switches to normal DOM mode
5. `connectStream()` flushes queued data and handles future chunks

**Important:** The `rootSelector` must match the element that your root component creates. If App creates `el('div').props({ class: 'container' })`, use `.container`.

## Key Patterns

### Minimal Worker

```typescript
import { renderToResponse } from './edge';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return renderToResponse(url.pathname, {
      createService,
      createApp: (svc) => App(svc),
    });
  },
};
```

### Minimal Client

```typescript
import { hydrateApp } from './edge';

hydrateApp({
  rootSelector: '.app',
  createService,
  createApp: (svc) => App(svc),
});
```
