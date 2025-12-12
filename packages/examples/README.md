# @lattice/examples

Example applications demonstrating Lattice features.

## Examples

| Example | Description | Run |
|---------|-------------|-----|
| **view** | Core view primitives (`el`, `map`, `match`) | `pnpm --filter @lattice/example-view dev` |
| **react** | React integration with `@lattice/react` | `pnpm --filter @lattice/example-react dev` |
| **router** | Client-side routing | `pnpm --filter @lattice/example-router dev` |
| **resource** | Async data fetching with `resource()` | `pnpm --filter @lattice/example-resource dev` |
| **ssr-router** | SSR with routing and data loading | `pnpm --filter @lattice/example-ssr-router dev` |
| **ssr-streaming** | Streaming SSR | `pnpm --filter @lattice/example-ssr-streaming dev` |
| **headless** | Portable headless behaviors | `pnpm --filter @lattice/example-headless dev` |
| **canvas** | Custom canvas adapter | `pnpm --filter @lattice/example-canvas dev` |
| **devtools** | DevTools integration | `pnpm --filter @lattice/example-devtools dev` |

## Quick Start

From the monorepo root:

```bash
# Run any example
pnpm --filter @lattice/example-view dev
pnpm --filter @lattice/example-react dev
pnpm --filter @lattice/example-ssr-router dev
# etc.
```

Or navigate to the example directory:

```bash
cd packages/examples/view
pnpm dev
```

## Example Descriptions

### view

Basic Lattice view example using `el`, `map`, and `match` for DOM rendering. Good starting point for understanding the view primitives.

### react

Shows how to use Lattice signals in React with `@lattice/react`. Demonstrates `useSignal`, `useSubscribe`, `useSelector`, and `createHook`.

### router

Client-side routing with `@lattice/router`. Multiple pages, navigation, and route parameters.

### resource

Async data fetching with `resource()`. Shows reactive dependencies, automatic refetching, and loading states.

### ssr-router

Full SSR example with routing and `load()` boundaries. Demonstrates server rendering, hydration, and data serialization.

### ssr-streaming

Streaming SSR that sends HTML immediately and streams data as it loads. Shows `renderToStream` and `connectStream`.

### headless

Portable behaviors that work across frameworks. Demonstrates the `(svc) => (...args) => API` pattern for reusable logic.

### canvas

Custom adapter example rendering to HTML5 Canvas instead of DOM. Shows how Lattice's adapter system enables alternative renderers.

### devtools

Example app instrumented for the Lattice DevTools extension. Useful for testing the devtools during development.

## License

MIT
