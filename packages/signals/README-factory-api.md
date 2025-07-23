# Factory-Based API Design

The new factory-based API enables true tree-shaking and extensibility:

## Tree-Shakeable Usage

```typescript
// Import ONLY what you need - truly tree-shakeable!
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';

// Create minimal API with just signals
const { signal } = createSignalAPI({
  signal: createSignalFactory,
});

// Only signal implementation is included in bundle
const count = signal(0);
```

## Add Just What You Need

```typescript
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';

// Only signal + computed in bundle, no effect/batch code!
const api = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
});
```

## Full API

```typescript
import { createSignalAPI, coreFactories } from '@lattice/signals';

// Use pre-bundled core factories
const api = createSignalAPI(coreFactories);

// All primitives available
const count = api.signal(0);
const doubled = api.computed(() => count.value * 2);
```

## Custom Primitives

```typescript
import { createSignalAPI, coreFactories, SignalFactory } from '@lattice/signals';

// Define custom factory
const createWatchFactory: SignalFactory<typeof watch> = (ctx) => {
  return function watch(
    source: () => unknown,
    callback: (value: unknown) => void
  ) {
    // Implementation using ctx...
  };
};

// Extend with custom primitives
const api = createSignalAPI({
  ...coreFactories,
  watch: createWatchFactory,
});

// Use custom primitive
api.watch(() => count.value, (val) => console.log(val));
```

## Benefits

1. **Tree-Shakeable**: Only imports what you use
2. **Extensible**: Add custom reactive primitives
3. **Type-Safe**: Full TypeScript support
4. **Performance**: No runtime overhead vs direct usage
5. **Isolated Contexts**: Each API has its own context/state

## Migration

The default exports still work for backwards compatibility:

```typescript
// Still works (lazy-loaded)
import { signal, computed } from '@lattice/signals';
```

But now bundlers can tree-shake unused primitives when using the factory approach.