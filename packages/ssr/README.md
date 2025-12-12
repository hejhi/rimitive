# @rimitive/ssr

Server-side rendering and hydration for Rimitive applications.

## Overview

Rimitive SSR renders your components to HTML on the server, waits for async data, then sends complete pages to the browser. The client hydrates the existing DOM instead of recreating it.

**Key insight**: Rimitive effects are synchronous and run on the server too. There's no special "client-only" mode—your reactive code works the same in both environments.

---

## Quick Start

### Server

```typescript
import { createServer } from 'node:http';
import {
  createDOMServerAdapter,
  renderToStringAsync,
} from '@rimitive/ssr/server';
import { createService } from './service.js';
import { App } from './App.js';

const server = createServer(async (req, res) => {
  // Create per-request adapter and service
  const { adapter, serialize, insertFragmentMarkers } =
    createDOMServerAdapter();
  const service = createService(adapter);

  // Render to string, awaiting all load() boundaries
  const html = await renderToStringAsync(App(service), {
    svc: service,
    mount: (spec) => spec.create(service),
    serialize,
    insertFragmentMarkers,
  });

  // Get loader data for hydration
  const loaderData = service.loader.getData();

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <script>window.__LATTICE_DATA__ = ${JSON.stringify(loaderData)}</script>
    </head>
    <body>
      <div class="app">${html}</div>
      <script src="/client.js"></script>
    </body>
    </html>
  `);
});

server.listen(3000);
```

### Client

```typescript
import { createClientAdapter } from '@rimitive/ssr/client';
import { createService } from './service.js';
import { App } from './App.js';

// Create hydration adapter for the SSR root element
const adapter = createClientAdapter(document.querySelector('.app')!);

// Get loader data from SSR
const loaderData = window.__LATTICE_DATA__;

// Create service with hydrating adapter and loader data
const service = createService(adapter, { loaderData });

// Hydrate - walks existing DOM, wires up reactivity
App(service).create(service);

// Switch to normal DOM mode for future updates
adapter.activate();
```

---

## Three Pieces

SSR requires three pieces working together:

1. **Server Adapter** — Uses linkedom instead of the real DOM
2. **Render Function** — Awaits async boundaries and serializes to HTML
3. **Client Adapter** — Hydrates existing DOM instead of creating new elements

### Server Adapter

```typescript
import { createDOMServerAdapter } from '@rimitive/ssr/server';

const { adapter, serialize, insertFragmentMarkers } = createDOMServerAdapter();
```

- `adapter` — Creates elements using linkedom (lightweight DOM implementation)
- `serialize` — Converts elements to HTML strings
- `insertFragmentMarkers` — Adds comment markers for hydration

### Render Functions

**Basic SSR** — waits for all data before sending:

```typescript
import { renderToStringAsync } from '@rimitive/ssr/server';

const html = await renderToStringAsync(appSpec, {
  svc: service,
  mount: (spec) => spec.create(service),
  serialize,
  insertFragmentMarkers,
});
```

**Streaming SSR** — sends HTML immediately, streams data as it loads:

```typescript
import { renderToStream, createStreamWriter } from '@rimitive/ssr/server';

const stream = createStreamWriter('__APP_STREAM__');

const { initialHtml, done } = renderToStream(appSpec, {
  mount: (spec) => spec.create(service),
  serialize,
  insertFragmentMarkers,
});

// Send initial HTML with loading states
res.write(initialHtml);

// Data streams via onResolve callback
await done;
```

### Client Adapter

```typescript
import { createClientAdapter } from '@rimitive/ssr/client';

const adapter = createClientAdapter(document.querySelector('.app')!);

// Hydrate the app
App(service).create(service);

// Switch to normal DOM mode
adapter.activate();
```

---

## Loading Data with load()

`load()` creates async boundaries that work with SSR:

```typescript
import type { LoadState, LoadStatus } from '@rimitive/view/load';

const UserProfile = (svc: Service) => {
  const { loader, match, el } = svc;

  return loader.load(
    'user-profile', // ID for hydration
    () => fetch('/api/user').then((r) => r.json()),
    (state: LoadState<User>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return el('div')('Loading...');
          case 'error':
            return el('div')(`Error: ${state.error()}`);
          case 'ready':
            return el('div')(
              el('h1')(state.data()!.name),
              el('p')(state.data()!.email)
            );
        }
      })
  );
};
```

The `id` is critical—it's how the client matches server-rendered data to components during hydration.

---

## Streaming SSR

Send HTML immediately and stream data as it loads:

### Server

```typescript
import {
  createDOMServerAdapter,
  renderToStream,
  createStreamWriter,
} from '@rimitive/ssr/server';

const STREAM_KEY = '__APP_STREAM__';
const stream = createStreamWriter(STREAM_KEY);

const server = createServer(async (req, res) => {
  const { adapter, serialize, insertFragmentMarkers } =
    createDOMServerAdapter();

  const service = createService(adapter, {
    onResolve: (id, data) => {
      // Stream each data chunk as it resolves
      res.write(`<script>${stream.chunkCode(id, data)}</script>`);
    },
  });

  const { initialHtml, done } = renderToStream(App(service), {
    mount: (spec) => spec.create(service),
    serialize,
    insertFragmentMarkers,
  });

  // Send document head with bootstrap script
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(`<!DOCTYPE html>
<html>
<head>
  <script>${stream.bootstrapCode()}</script>
</head>
<body>
  <div class="app">${initialHtml}</div>
  <script src="/client.js"></script>`);

  // Wait for all data to stream
  await done;

  res.write('</body></html>');
  res.end();
});
```

### Client

```typescript
import { createClientAdapter, connectStream } from '@rimitive/ssr/client';

const adapter = createClientAdapter(document.querySelector('.app')!);
const service = createService(adapter);

App(service).create(service);
adapter.activate();

// Connect to the stream - receives queued and future data chunks
connectStream(service, '__APP_STREAM__');
```

---

## Shared Service Pattern

Your service factory takes an adapter, so both server and client use the same components:

```typescript
// service.ts
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMatchModule } from '@rimitive/view/match';
import { createLoaderModule } from '@rimitive/view/load';
import type { Adapter } from '@rimitive/view/types';
import type { DOMAdapterConfig } from '@rimitive/view/adapters/dom';

export type ServiceOptions = {
  loaderData?: Record<string, unknown>;
  onResolve?: (id: string, data: unknown) => void;
};

export function createService(
  adapter: Adapter<DOMAdapterConfig>,
  options?: ServiceOptions
) {
  return compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    createElModule(adapter),
    createMatchModule(adapter),
    createLoaderModule({
      initialData: options?.loaderData,
      onResolve: options?.onResolve,
    })
  );
}
```

---

## Browser-Only Code

Since effects and refs run on the server, browser-specific code needs guards:

```typescript
// Guard with environment check
el('input').ref((el) => {
  if (typeof window === 'undefined') return;
  el.focus();
})();

// Optional chaining for methods that might not exist
el('div').ref((el) => {
  el.scrollIntoView?.({ behavior: 'smooth' });
})();
```

**What needs guards:**

- `focus()`, `blur()`, `scrollIntoView()`
- `getBoundingClientRect()`, `animate()`
- Browser globals: `window`, `document`, `localStorage`

**What works without guards:**

- Event handlers via `on()` or props (`onclick`) — skipped on server
- Basic DOM properties: `className`, `textContent`, `id`

---

## Import Guide

| Use Case         | Import                                                                               |
| ---------------- | ------------------------------------------------------------------------------------ |
| Server rendering | `import { createDOMServerAdapter, renderToStringAsync } from '@rimitive/ssr/server'` |
| Streaming server | `import { renderToStream, createStreamWriter } from '@rimitive/ssr/server'`          |
| Client hydration | `import { createClientAdapter } from '@rimitive/ssr/client'`                         |
| Streaming client | `import { createClientAdapter, connectStream } from '@rimitive/ssr/client'`          |

---

## API Reference

### Server

```typescript
// Adapter
createDOMServerAdapter(): {
  adapter: Adapter<DOMAdapterConfig>;
  serialize: (element: Element) => string;
  insertFragmentMarkers: (element: Element) => void;
}

// Render functions
renderToStringAsync(spec, options): Promise<string>
renderToStream(spec, options): {
  initialHtml: string;
  done: Promise<void>;
  pendingCount: number;
}

// Streaming
createStreamWriter(key: string): {
  bootstrapCode(): string;
  chunkCode(id: string, data: unknown): string;
}
```

### Client

```typescript
// Adapter
createClientAdapter(root: HTMLElement): ClientAdapter

interface ClientAdapter {
  // ... adapter methods
  activate(): void;  // Switch from hydration to normal mode
}

// Streaming
connectStream(service, key: string): void
```

---

## When to Use Each Mode

**Basic SSR (`renderToStringAsync`):**

- All data loads quickly (< 500ms)
- SEO crawlers need complete HTML
- Simpler setup

**Streaming SSR (`renderToStream`):**

- Some data sources are slow
- Users should see content immediately
- Different parts have different data needs

Both use the same `load()` API in components—only server setup differs.

---

## License

MIT
