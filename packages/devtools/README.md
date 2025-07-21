# @lattice/devtools

Developer tools for debugging and profiling Lattice applications.

## Installation

```bash
pnpm add @lattice/devtools
```

## Usage

The devtools package provides instrumentation capabilities for Lattice contexts through a first-class instrumentation API:

```javascript
import { createContext, signalExtension, computedExtension, effectExtension } from '@lattice/lattice';
import { createInstrumentation, enableDevTools } from '@lattice/devtools';

// Enable global DevTools API for browser extension
enableDevTools();

// Create instrumentation context
const instrumentation = createInstrumentation({
  name: 'My App',
  maxEvents: 10000
});

// Create lattice context with instrumentation
const context = createContext(
  { instrumentation },
  signalExtension,
  computedExtension,
  effectExtension
);

// Use context normally - all operations are instrumented
const count = context.signal(0, 'count');
const doubled = context.computed(() => count.value * 2, 'doubled');

context.effect(() => {
  console.log('Count:', count.value, 'Doubled:', doubled.value);
}, 'logger');

// Updates are tracked
count.value = 5;
```

## Chrome Extension

For the best debugging experience, install the [Lattice DevTools Chrome Extension](../devtools-extension).

## API

### `createInstrumentation(options?: DevToolsOptions)`

Creates an instrumentation context that can be passed to `createContext`.

Options:
- `name?: string` - Name for your application
- `maxEvents?: number` - Maximum number of events to buffer (default: 10000)
- `trackReads?: boolean` - Enable tracking of signal reads
- `trackComputations?: boolean` - Enable tracking of computed executions
- `trackEffects?: boolean` - Enable tracking of effect executions
- `trackWrites?: boolean` - Enable tracking of signal writes

### `enableDevTools()`

Enables the global DevTools API on the window object for browser extensions.

```javascript
import { enableDevTools } from '@lattice/devtools';

// Call this once at app startup
enableDevTools();
```

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
- `EFFECT_DISPOSED` - When an effect is disposed
- `BATCH_START` - When a batch operation begins
- `BATCH_END` - When a batch operation completes
- `CONTEXT_DISPOSED` - When a context is disposed

## Legacy Middleware API

For backwards compatibility, the package also exports a middleware API:

```javascript
import { withDevTools } from '@lattice/devtools';
import { createContext } from '@lattice/lattice';

const context = withDevTools(createContext(), {
  name: 'My App'
});
```

## Performance Impact

The instrumentation adds minimal overhead:
- ~5-10% for signal reads/writes when read tracking is enabled
- ~10-15% for computed recalculations
- Negligible impact when instrumentation is not provided to context

Always disable devtools in production builds by not providing the instrumentation option to `createContext`.