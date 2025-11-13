# Lattice SSR Example

Demonstrates server-side rendering with islands hydration using Lattice.

## Features

- **Server-side rendering** with linkedom
- **Islands architecture** - only ship JS for interactive components
- **Automatic hydration** with try-with-fallback strategy
- **No build step required** - uses native ESM

## Running

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Architecture

- **Static sections**: Rendered on server, no JS shipped
- **Island components**: Interactive regions that hydrate on client
- **Try-with-fallback**: Attempts hydration, falls back to client render on mismatch

## Islands

### Counter
Interactive counter with increment/decrement buttons.

### TodoList
Todo list with add/remove functionality.

Both islands:
- Render to HTML on server
- Ship minimal JS (~1kb each)
- Hydrate from existing DOM
- Work independently
