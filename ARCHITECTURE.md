# Lattice Architecture

## Core Design Principles

Lattice uses a **context-based architecture** with functional APIs for maximum flexibility and tree-shaking.

## API Overview

### Creating a Context

```typescript
import { createLattice } from '@lattice/lattice';

const context = createLattice();
```

### Core Primitives

```typescript
// Reactive state
const count = context.signal(0);

// Derived values
const doubled = context.computed(() => count.value * 2);

// Side effects
const dispose = context.effect(() => {
  console.log(`Count: ${count.value}`);
});

// Batch updates
context.batch(() => {
  count.value = 1;
  // other updates...
});
```

### React Integration

```typescript
import { useLatticeContext, useSignal, useSubscribe } from '@lattice/react';

function Counter() {
  // Option 1: Create signals in component
  const context = useLatticeContext();
  const count = context.signal(0);
  
  // Option 2: Use React-specific hooks
  const [value, setValue] = useSignal(0);
  
  // Subscribe to external signals
  const currentCount = useSubscribe(count);
  
  return <div>{currentCount}</div>;
}
```

## Package Structure

- **@lattice/signals** - Core reactive primitives (zero dependencies)
- **@lattice/lattice** - Context and extension system
- **@lattice/react** - React bindings and hooks
- **@lattice/devtools** - Development instrumentation
- **@lattice/devtools-extension** - Browser DevTools (migration pending)

## Migration from Store API

The Store API has been completely removed in favor of direct context usage:

```typescript
// OLD (removed)
const store = createStore({ count: 0 });
store.state.count.value = 1;

// NEW
const context = createLattice();
const count = context.signal(0);
count.value = 1;
```

## Tree-Shaking

Individual primitives can be imported for optimal bundle size:

```typescript
// Import only what you need
import { signal } from '@lattice/signals/signal';
import { computed } from '@lattice/signals/computed';
import { subscribe } from '@lattice/signals/subscribe';

// Standalone usage (no context needed)
const count = signal(0);
const doubled = computed(() => count.value * 2);
const unsub = subscribe(doubled, () => console.log('changed!'));
```