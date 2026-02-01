# @rimitive/ssr

Server-side rendering and hydration. Effects are synchronous and run on the server—your reactive code works the same in both environments.

## Quick Start

### Server

```typescript
import { createServer } from 'node:http';
import {
  createParse5Adapter,
  renderToStringAsync,
} from '@rimitive/ssr/server';
import { createService } from './service.js';
import { App } from './App.js';

const server = createServer(async (req, res) => {
  const { adapter, serialize, insertFragmentMarkers } =
    createParse5Adapter();
  const service = createService(adapter);

  const html = await renderToStringAsync(App(service), {
    svc: service,
    mount: (spec) => spec.create(service),
    serialize,
    insertFragmentMarkers,
  });

  const loaderData = service.loader.getData();

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <script>window.__LOADER_DATA__ = ${JSON.stringify(loaderData)}</script>
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

const adapter = createClientAdapter(document.querySelector('.app')!);
const ssrData = window.__LOADER_DATA__;
const service = createService(adapter, { hydrationData: ssrData });

App(service).create(service);
adapter.activate(); // Switch to normal DOM mode
```

---

## Shared Service

Your service factory takes an adapter, so server and client use the same components:

```typescript
// service.ts
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMatchModule } from '@rimitive/view/match';
import { createLoaderModule } from '@rimitive/view/load';
import type { Adapter } from '@rimitive/view/types';
import type { DOMAdapterConfig } from '@rimitive/view/adapters/dom';

export function createService(
  adapter: Adapter<DOMAdapterConfig>,
  options?: { hydrationData?: Record<string, unknown>; onResolve?: (id: string, data: unknown) => void }
) {
  return compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    createElModule(adapter),
    createMatchModule(adapter),
    createLoaderModule({
      initialData: options?.hydrationData,
      onResolve: options?.onResolve,
    })
  );
}
```

---

## Loading Data

`load()` creates async boundaries. The `id` is how the client matches server-rendered data during hydration:

```typescript
const UserProfile = (svc: Service) => {
  const { loader, match, el } = svc;

  return loader.load(
    'user-profile', // ID for hydration
    () => fetch('/api/user').then((r) => r.json()),
    (state) =>
      match(state.status, (status) => {
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

---

## Streaming

Send HTML immediately, stream data as it loads:

### Server

```typescript
import {
  createParse5Adapter,
  renderToStream,
  createStreamWriter,
} from '@rimitive/ssr/server';

const stream = createStreamWriter('__APP_STREAM__');

const server = createServer(async (req, res) => {
  const { adapter, serialize, insertFragmentMarkers } =
    createParse5Adapter();

  const service = createService(adapter, {
    onResolve: (id, data) => {
      res.write(`<script>${stream.chunkCode(id, data)}</script>`);
    },
  });

  const { initialHtml, done } = renderToStream(App(service), {
    mount: (spec) => spec.create(service),
    serialize,
    insertFragmentMarkers,
  });

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(`<!DOCTYPE html>
<html>
<head><script>${stream.bootstrapCode()}</script></head>
<body>
  <div class="app">${initialHtml}</div>
  <script src="/client.js"></script>`);

  await done;
  res.end('</body></html>');
});
```

### Client

```typescript
import { createClientAdapter, connectStream } from '@rimitive/ssr/client';

const adapter = createClientAdapter(document.querySelector('.app')!);
const service = createService(adapter);

App(service).create(service);
adapter.activate();
connectStream(service, '__APP_STREAM__');
```

---

## Browser-Only Code

Effects and refs run on the server. Guard browser-specific code:

```typescript
el('input').ref((el) => {
  if (typeof window === 'undefined') return;
  el.focus();
})();
```

**Needs guards:** `focus()`, `blur()`, `scrollIntoView()`, `getBoundingClientRect()`, `window`, `localStorage`

**Works without guards:** Event handlers (`onclick`), basic DOM properties (`className`, `textContent`)
