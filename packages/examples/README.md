# Lattice Examples

This package contains examples of using the Lattice framework.

## Running the Examples

There are two ways to run the examples:

### 1. Using Vite (Browser)

This method runs the examples in a browser with a simple UI:

```bash
# From the examples package directory
pnpm dev

# Or from the root directory
pnpm --filter @lattice/examples dev
```

### 2. Using Node.js

This method runs the examples directly in Node.js and outputs to the console:

```bash
# From the examples package directory
pnpm demo

# Or from the root directory
pnpm --filter @lattice/examples demo
```

## Building

To build the examples:

```bash
# From the examples package directory
pnpm build       # Build TypeScript
pnpm build:vite  # Build Vite bundle

# Or from the root directory
pnpm --filter @lattice/examples build
pnpm --filter @lattice/examples build:vite
```
