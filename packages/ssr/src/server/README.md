# @rimitive/ssr — Server Utilities

Server-side rendering abstractions for Rimitive. These utilities compose into a complete SSR server with progressive streaming, data prefetching, and per-request isolation.

```
import { ... } from '@rimitive/ssr/server'
```

## Quick Start

A complete streaming SSR server in ~30 lines:

```ts
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createParse5Adapter,
  createStreamingServer,
  createStaticHandler,
  createDataPrefetchHandler,
} from '@rimitive/ssr/server';
import { createService } from './service.js';
import { AppLayout } from './App.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serveStatic = createStaticHandler({
  clientDir: join(__dirname, '../dist/client'),
  urlPatterns: ['/client.js', '/assets/'],
});

const handlePrefetch = createDataPrefetchHandler({
  createService: (path) => {
    const { adapter } = createParse5Adapter();
    return createService(adapter, { initialPath: path });
  },
  createApp: (svc) => AppLayout(svc),
  mount: (svc) => (spec) => spec.create(svc),
  getData: (svc) => svc.loader.getData(),
});

const handleStreaming = createStreamingServer({
  shell: { title: 'My App', streamKey: '__APP__', styles: getStyles() },
  clientSrc: '/client.js',
  createService: ({ pathname, onResolve }) => {
    const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
    const service = createService(adapter, { initialPath: pathname, onResolve });
    return { service, serialize, insertFragmentMarkers };
  },
  createApp: (svc) => AppLayout(svc),
  mount: (svc) => (spec) => spec.create(svc),
});

const server = createServer(async (req, res) => {
  if (serveStatic(req, res)) return;
  if (await handlePrefetch(req, res)) return;
  await handleStreaming(req, res);
});

server.listen(3000);
```

Compare this to writing the request handling, HTML shell, streaming bootstrap, and chunk delivery by hand. The abstraction layer handles all of that.

---

## API Reference

### Render Functions

#### `renderToString(nodeRef, serialize)`

Synchronous HTML serialization. No async data support.

```ts
const html = renderToString(mountedNode, serialize);
```

#### `renderToStringAsync(renderable, options)`

Waits for all `load()` boundaries to resolve before returning HTML.

```ts
const html = await renderToStringAsync(AppSpec(service), {
  svc: service,
  mount: (spec) => spec.create(service),
  serialize,
  insertFragmentMarkers,
});
```

Accepts `NodeRef`, `AsyncFragment`, or `RefSpec` as input.

#### `renderToStream(spec, options) → StreamResult`

Returns initial HTML immediately with pending states. Async boundaries resolve in the background via `onResolve`.

```ts
const { initialHtml, done, pendingCount } = renderToStream(AppSpec(service), {
  mount: (spec) => spec.create(service),
  serialize,
  insertFragmentMarkers,
});

res.write(initialHtml);
await done; // chunks stream via onResolve callback
res.end();
```

Returns `{ initialHtml: string, done: Promise<void>, pendingCount: number }`.

#### `renderToData(spec, options)`

Mounts and resolves all async boundaries to collect data without producing HTML. For data-only prefetch endpoints.

```ts
const data = await renderToData(AppSpec(service), {
  mount: (spec) => spec.create(service),
  getData: () => service.loader.getData(),
});
// data = { 'user-1': { name: 'Alice' }, 'stats': { ... } }
```

---

### Server Adapter

#### `createParse5Adapter()`

Creates a fresh server-side adapter using parse5's AST. Call once per request.

```ts
const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
```

Returns:
- `adapter` — tree manipulation interface for element creation
- `serialize` — converts an element to an HTML string
- `insertFragmentMarkers` — inserts `<!-- fragment-start/end -->` comment markers around async boundaries

---

### Streaming

#### `createStreamWriter(streamKey)`

Low-level factory for generating streaming JavaScript code.

```ts
const stream = createStreamWriter('__APP_STREAM__');

// In <head>:
res.write(`<script>${stream.bootstrapCode()}</script>`);

// As async boundaries resolve:
res.write(`<script>${stream.chunkCode('stats', { users: 100 })}</script>`);
```

#### `createServerStreamWriter(streamKey?)`

Higher-level wrapper that generates complete `<script>` tags.

```ts
const stream = createServerStreamWriter(); // defaults to '__RIMITIVE_STREAM__'

res.write(stream.bootstrapScript());          // <script>...</script>
res.write(stream.chunkScript('stats', data)); // <script>...</script>
```

#### `generateChunkScript(stream, id, data)` / `generateBootstrapScript(stream)`

Standalone helpers for wrapping any `StreamWriter` in `<script>` tags. Useful with `createHtmlShell().stream`.

#### `safeJsonStringify(value)`

XSS-safe JSON serialization for embedding in `<script>` tags. Escapes `<`, `>`, `&`, U+2028, and U+2029.

```ts
res.write(`<script>window.DATA = ${safeJsonStringify(data)}</script>`);
```

---

### HTML Shell

#### `createHtmlShell(options?) → HtmlShell`

Generates composable HTML document parts for streaming responses.

```ts
const shell = createHtmlShell({
  title: 'My App',
  streamKey: '__APP_STREAM__',
  hydrationData: { user: { name: 'Alice' } },
});

res.write(shell.start);       // <!DOCTYPE html>...<div id="app">
res.write(initialHtml);
res.write(shell.appClose);    // </div>
res.write(shell.end('/client.js')); // hydration data + <script type="module">
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | `'Rimitive App'` | Document title |
| `styles` | `string \| string[]` | — | CSS to inject in `<style>` |
| `head` | `string` | — | Additional `<head>` content |
| `streamKey` | `string` | — | Enables streaming; creates a `StreamWriter` on `shell.stream` |
| `hydrationData` | `Record<string, unknown>` | — | Data embedded for client hydration |
| `hydrationKey` | `string` | `'__RIMITIVE_DATA__'` | Window property name for hydration data |
| `rootId` | `string \| false` | `'app'` | App container element ID; `false` skips the wrapper |

---

### Service Factory

#### `createServiceFactory(config?)`

Creates per-request service instances with automatic adapter setup and base modules (Signal, Computed, Effect, El, Match, Loader).

```ts
const factory = createServiceFactory({
  modules: [BatchModule],
  lifecycle: {
    onCreate: (svc, adapter) => console.log('created'),
    onDestroy: (svc) => console.log('destroyed'),
  },
});

const { service, adapterResult } = factory({
  hydrationData: loaderData,
  onResolve: (id, data) => stream.write(chunkScript(id, data)),
});
```

#### `createConfiguredServiceFactory(config)`

Like `createServiceFactory`, but custom modules receive the per-request adapter. Use when modules need the adapter (e.g., `MapModule.with({ adapter })`).

```ts
const factory = createConfiguredServiceFactory({
  modules: (adapter) => [
    BatchModule,
    MapModule.with({ adapter }),
  ],
});
```

#### `createRequestScope(factory, options?)`

Wraps a factory call with automatic lifecycle management. `dispose()` is idempotent.

```ts
const scope = createRequestScope(factory, { hydrationData });
try {
  const html = await renderToStringAsync(appSpec, { ... });
  res.end(html);
} finally {
  scope.dispose();
}
```

#### `handleServiceError(error, lifecycle?)`

Generates a standardized 500 error response. Calls `lifecycle.onError()` for custom bodies.

```ts
try {
  // render...
} catch (error) {
  const { status, body, headers } = handleServiceError(error, lifecycle);
  res.writeHead(status, headers);
  res.end(body);
}
```

---

### High-Level Handlers

#### `createStreamingServer(config) → StreamingHandler`

Single async handler for complete streaming SSR. Combines HTML shell, service creation, streaming, and chunk delivery.

```ts
const handleStreaming = createStreamingServer({
  shell: {
    title: 'My App',
    streamKey: '__APP_STREAM__',
    styles: getStyles(),
  },
  clientSrc: '/client.js',
  createService: ({ pathname, onResolve }) => {
    const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
    const service = createService(adapter, { initialPath: pathname, onResolve });
    return { service, serialize, insertFragmentMarkers };
  },
  createApp: (svc) => AppLayout(svc),
  mount: (svc) => (spec) => spec.create(svc),
});

// Use as Node.js http handler:
const server = createServer(async (req, res) => {
  await handleStreaming(req, res);
});
```

**Config:**

| Field | Type | Description |
|-------|------|-------------|
| `shell` | `HtmlShellOptions & { streamKey: string }` | HTML template options (must include `streamKey`) |
| `clientSrc` | `string` | Path to client entry point |
| `createService` | `(ctx) => { service, serialize, insertFragmentMarkers }` | Per-request service factory |
| `createApp` | `(service) => RefSpec` | Creates the app spec |
| `mount` | `(service) => (spec) => NodeRef` | Mount function |

**Flow:**
1. Parse request URL
2. Create per-request service with `onResolve` wired to stream chunks
3. Render initial HTML with pending states
4. Write: shell start + initial HTML + client script (immediate TTFB)
5. Stream async chunks as boundaries resolve
6. Close HTML document

#### `createStaticHandler(config) → StaticHandler`

Serves static files (JS bundles, lazy-loaded chunks). Returns `true` if handled.

```ts
const serveStatic = createStaticHandler({
  clientDir: join(__dirname, '../dist/client'),
  urlPatterns: ['/client.js', '/assets/'],
});

if (serveStatic(req, res)) return; // handled
```

- Exact matches (e.g., `/client.js`) serve the file directly
- Prefix matches ending with `/` (e.g., `/assets/`) serve files relative to `clientDir`
- Returns 404 for missing files

#### `createDataPrefetchHandler(config) → DataPrefetchHandler`

Serves pre-rendered JSON data for client-side navigation. Returns `true` if handled.

```ts
const handlePrefetch = createDataPrefetchHandler({
  prefix: '/_data',  // default
  createService: (path) => {
    const { adapter } = createParse5Adapter();
    return createService(adapter, { initialPath: path });
  },
  createApp: (svc) => AppLayout(svc),
  mount: (svc) => (spec) => spec.create(svc),
  getData: (svc) => svc.loader.getData(),
});

// Client fetches: GET /_data/users/123 → { "user": { ... } }
```

---

## Key Patterns

### Per-Request Isolation

Every request gets a fresh adapter and service. No shared state between requests:

```ts
// Each call to createParse5Adapter() creates a new parse5 AST
// Each service instance has its own signal graph
const { adapter, serialize } = createParse5Adapter();
const service = createService(adapter);
```

### Handler Composition

Handlers return booleans indicating whether they handled the request. Compose them with early returns:

```ts
const server = createServer(async (req, res) => {
  if (serveStatic(req, res)) return;          // sync: boolean
  if (await handlePrefetch(req, res)) return;  // async: Promise<boolean>
  await handleStreaming(req, res);              // async: catch-all
});
```

### Streaming Architecture

1. Shell written immediately (HTML skeleton + streaming bootstrap in `<head>`)
2. Initial app HTML with pending states for `load()` boundaries
3. Client script tag sent so browser starts loading while data streams
4. Async chunks stream as `<script>` tags via `onResolve` callback
5. Document closed after all boundaries resolve

---

## Migration from Inline Server

If you have a hand-written `server.ts` with manual HTML construction and streaming:

**Before** (~200+ lines):
- Manual HTML template strings
- Custom streaming setup with `createStreamWriter`
- Inline static file serving
- Manual data prefetch endpoint

**After** (~30 lines):
```ts
const serveStatic = createStaticHandler({ clientDir, urlPatterns });
const handlePrefetch = createDataPrefetchHandler({ createService, createApp, mount, getData });
const handleStreaming = createStreamingServer({ shell, clientSrc, createService, createApp, mount });

createServer(async (req, res) => {
  if (serveStatic(req, res)) return;
  if (await handlePrefetch(req, res)) return;
  await handleStreaming(req, res);
}).listen(3000);
```

Each handler is independent. Use only what you need — `createStreamingServer` alone is a complete streaming SSR solution.

---

## Troubleshooting

### "Cross-request state leakage"

Always call `createParse5Adapter()` per request. Never reuse an adapter or service across requests.

### Streaming chunks not arriving

Ensure `onResolve` is wired through the loader module. The callback must be passed when creating the service:

```ts
createService: ({ onResolve }) => {
  const service = createService(adapter, { onResolve }); // ← must pass onResolve
  return { service, serialize, insertFragmentMarkers };
},
```

### Hydration mismatch

The `load()` IDs must match between server and client. Use stable string IDs (not dynamic values that change between renders).

### Static files returning 404

Check that `clientDir` points to the built output directory, and that `urlPatterns` includes both exact paths and prefix patterns:

```ts
urlPatterns: ['/client.js', '/assets/']
//            ^exact match    ^prefix match (note trailing slash)
```

### Content-Type always `application/javascript`

`createStaticHandler` is designed for JS assets only. For other asset types, use a general-purpose static file middleware or serve them separately.

---

## Full Documentation

[rimitive.dev](https://rimitive.dev)
