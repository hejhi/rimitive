# @rimitive/examples

Example applications demonstrating Rimitive features.

## Examples

| Example           | Description                                 | Run                                                 |
| ----------------- | ------------------------------------------- | --------------------------------------------------- |
| **view**          | Core view primitives (`el`, `map`, `match`) | `pnpm --filter @rimitive/example-view dev`          |
| **react**         | React integration with `@rimitive/react`    | `pnpm --filter @rimitive/example-react dev`         |
| **router**        | Client-side routing                         | `pnpm --filter @rimitive/example-router dev`        |
| **resource**      | Async data fetching with `resource()`       | `pnpm --filter @rimitive/example-resource dev`      |
| **ssr-router**    | SSR with routing and data loading           | `pnpm --filter @rimitive/example-ssr-router dev`    |
| **ssr-streaming** | Streaming SSR                               | `pnpm --filter @rimitive/example-ssr-streaming dev` |
| **headless**      | Portable headless behaviors                 | `pnpm --filter @rimitive/example-headless dev`      |
| **canvas**        | Custom canvas adapter                       | `pnpm --filter @rimitive/example-canvas dev`        |
| **devtools**      | DevTools integration                        | `pnpm --filter @rimitive/example-devtools dev`      |

## Quick Start

From the monorepo root:

```bash
# Run any example
pnpm --filter @rimitive/example-view dev
pnpm --filter @rimitive/example-react dev
pnpm --filter @rimitive/example-ssr-router dev
# etc.
```

Or navigate to the example directory:

```bash
cd packages/examples/view
pnpm dev
```

## Example Descriptions

### view

Basic Rimitive view example using `el`, `map`, and `match` for DOM rendering. Good starting point for understanding the view primitives.

### react

Shows how to use Rimitive signals in React with `@rimitive/react`. Demonstrates `useSignal`, `useSubscribe`, `useSelector`, and `createHook`.

### router

Client-side routing with `@rimitive/router`. Multiple pages, navigation, and route parameters.

### resource

Async data fetching with `resource()`. Shows reactive dependencies, automatic refetching, and loading states.

### ssr-router

Full SSR example with routing and `load()` boundaries. Demonstrates server rendering, hydration, and data serialization.

### ssr-streaming

Streaming SSR that sends HTML immediately and streams data as it loads. Shows `renderToStream` and `connectStream`.

### headless

Portable behaviors that work across frameworks. Demonstrates the `(svc) => (...args) => API` pattern for reusable logic.

### canvas

Custom adapter example rendering to HTML5 Canvas instead of DOM. Shows how Rimitive's adapter system enables alternative renderers.

### devtools

Example app instrumented for the Rimitive DevTools extension. Useful for testing the devtools during development.

## License

MIT
