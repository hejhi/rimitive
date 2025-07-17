# Lattice Examples

This directory contains example applications demonstrating various Lattice features.

## Structure

Each subdirectory is a separate example application with its own dependencies and build configuration:

- `devtools/` - Demonstrates the DevTools integration using the `withDevTools` middleware

## Running Examples

From the root of the monorepo:

```bash
# Run the devtools example
pnpm example:devtools

# Or run directly from this directory
cd packages/examples/devtools
pnpm dev
```

## Adding New Examples

1. Create a new directory under `packages/examples/`
2. Add a `package.json` with a unique name (e.g., `@lattice/example-your-feature`)
3. Add your example code
4. The example will automatically be recognized as a workspace package

All examples have access to the workspace dependencies, so you can import from `@lattice/lattice`, `@lattice/signals`, etc.
