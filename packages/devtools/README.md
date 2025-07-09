# @lattice/devtools

Developer tools for debugging and profiling Lattice applications.

## Installation

```bash
pnpm add @lattice/devtools
```

## Usage

The devtools package provides instrumented versions of `createLattice` and `createStore` that emit events for debugging:

```javascript
import { enableDevTools, createLattice, createStore } from '@lattice/devtools';

// Enable DevTools before creating any contexts
enableDevTools({
  name: 'My App',
  enableProfiling: true
});

// Use the instrumented versions - they work exactly like the originals
const context = createLattice('Main Context');
const store = createStore({ count: 0 }, context);

// Optional: name your signals, computed values, and effects for better debugging
const doubled = context.computed(() => store.count.value * 2, 'doubled');

context.effect(() => {
  console.log('Count:', store.count.value);
}, 'logEffect');
```

## Chrome Extension

For the best debugging experience, install the [Lattice DevTools Chrome Extension](../devtools-extension).

## API

### `enableDevTools(options?: DevToolsOptions)`

Enables devtools instrumentation. Call this before creating any contexts.

Options:
- `name?: string` - Name for your application
- `enableProfiling?: boolean` - Enable performance profiling

### `createLattice(name?: string)`

Creates an instrumented Lattice context that emits debugging events.

### `createStore(initialState, context?, name?)`

Creates an instrumented store that tracks all state updates.

## Events

The devtools emit the following events:

- `CONTEXT_CREATED` - When a new context is created
- `SIGNAL_CREATED` - When a signal is created
- `SIGNAL_READ` - When a signal value is read
- `SIGNAL_WRITE` - When a signal value is written
- `COMPUTED_CREATED` - When a computed is created
- `COMPUTED_START` - When a computed starts recalculating
- `COMPUTED_END` - When a computed finishes recalculating
- `EFFECT_CREATED` - When an effect is created
- `EFFECT_START` - When an effect starts running
- `EFFECT_END` - When an effect finishes running
- `STORE_CREATED` - When a store is created
- `STORE_UPDATE_START` - When a store update begins
- `STORE_UPDATE_END` - When a store update completes
- `CONTEXT_DISPOSED` - When a context is disposed

## Performance Impact

The instrumentation adds minimal overhead:
- ~5-10% for signal reads/writes
- ~10-15% for computed recalculations
- Negligible impact when devtools are disabled

Always disable devtools in production builds.