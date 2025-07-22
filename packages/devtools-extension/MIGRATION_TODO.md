# DevTools Extension Migration TODO

The devtools-extension package needs to be updated to work with the new context-based API.

## Current Issues

The extension was built against the old Store-based API:
- Uses `createStore()` which no longer exists
- Expects the old prototype methods on signals/computed
- Has extensive TypeScript errors due to API changes

## Migration Plan

1. **Update store management**
   - Replace `createStore()` with direct signal creation using context
   - Update state management to use individual signals

2. **Fix type imports**
   - Update all imports to use the new functional API
   - Remove references to Store type

3. **Update event handling**
   - Adapt to new instrumentation API if changed
   - Update log processing for new event formats

## Temporary Solution

Until migration is complete, the devtools-extension is excluded from the main build checks.
To work on it separately:

```bash
# Build core packages first
pnpm build:lattice

# Work on devtools-extension independently
cd packages/devtools-extension
pnpm dev
```