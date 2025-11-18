# SSR + Router Example

This example demonstrates server-side rendering with routing using Lattice's universal API. The same router code works on both server and client without any environment-specific conditionals.

## Features

- **Server-Side Rendering**: Pages are rendered on the server with the correct route
- **Universal Router API**: Same code works on server and client
- **Router SSR Context**: Request URLs automatically flow to the router during SSR
- **Islands Architecture**: Mix static and interactive content
- **Selective Hydration**: Only ship JavaScript for interactive components

## How It Works

### Server-Side Flow

1. Server receives a request (e.g., `/products`)
2. Creates a router context with the request URL: `createRouterContext('/products')`
3. Renders the app within both SSR and router contexts
4. Router automatically uses the SSR context to determine which route to render
5. HTML is sent to client with serialized island data

### Client-Side Flow

1. Client loads the HTML and JavaScript bundle
2. Hydrates only the interactive islands
3. Router continues working on the client for navigation
4. No environment detection needed - the universal API handles it

### The Universal Pattern

```ts
// Server (server.ts)
const routerCtx = createRouterContext(req.url);
const html = runWithRouterContext(routerCtx, () => {
  // Router automatically uses routerCtx.initialPath
  return renderToString(mount(App()));
});

// Client (client.ts)
// No router context needed - automatically uses window.location
hydrator.hydrate(ProductFilter);
```

## Project Structure

```
src/
├── server.ts          # Server with router SSR context
├── client.ts          # Client hydration
├── api.ts             # Shared signals API
├── pages/
│   ├── Home.ts        # Static home page
│   ├── About.ts       # Static about page
│   └── Products.ts    # Page with island
└── islands/
    └── ProductFilter.ts  # Interactive island component
```

## Running the Example

### Development Mode

```bash
# Install dependencies
pnpm install

# Start dev server (with hot reload)
pnpm dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build both server and client
pnpm build

# Start production server
pnpm start
```

## Routes

- `/` - Home page (static)
- `/about` - About page (static)
- `/products` - Products page (contains interactive island)

## Key Concepts

### Universal API

The router uses `createCurrentPathSignal` which automatically detects the environment:

- **Server**: Reads from `RouterSSRContext.initialPath`
- **Client**: Reads from `window.location`

No manual environment checks needed!

### Router SSR Context

```ts
import { createRouterContext, runWithRouterContext } from '@lattice/router/ssr-context';

const ctx = createRouterContext('/products');
const html = runWithRouterContext(ctx, () => {
  // Router components use ctx.initialPath during SSR
  return renderToString(mount(App()));
});
```

### Islands + Routing

Pages can be purely static or contain islands:

- **Static pages** (Home, About): No JavaScript shipped
- **Pages with islands** (Products): Only the island ships JavaScript

This gives you fine-grained control over your JavaScript bundle size.

## Comparison with CSR Router Example

**CSR Router Example** (`/examples/router`):
- Client-side only
- Uses DOM renderer
- All pages are interactive
- Navigation updates browser URL

**SSR Router Example** (this example):
- Server-side rendering first
- Uses SSR renderer for initial render
- Mix of static and interactive content
- Same routing API as CSR example

The universal API means you can use the same router patterns in both!
