# Lattice Extension System

Lattice uses a unified extension system where all functionality (signal, computed, effect, etc.) is implemented as extensions. This provides optimal tree-shaking and easy extensibility.

## Using Extensions

### Minimal Context (Best for Tree-Shaking)

```typescript
import { createContext } from '@lattice/lattice';
import { signalExtension } from '@lattice/lattice/extensions/signal';
import { computedExtension } from '@lattice/lattice/extensions/computed';

// Only includes signal and computed
const context = createContext(
  signalExtension,
  computedExtension
);

const count = context.signal(0);
const doubled = context.computed(() => count.value * 2);
```

### Custom Selection

```typescript
import { createContext } from '@lattice/lattice';
import { signalExtension } from '@lattice/lattice/extensions/signal';
import { effectExtension } from '@lattice/lattice/extensions/effect';
import { selectExtension } from '@lattice/lattice/extensions/select';
import { subscribeExtension } from '@lattice/lattice/extensions/subscribe';

const context = createContext(
  signalExtension,
  effectExtension,
  selectExtension,
  subscribeExtension
);
```

## Creating Custom Extensions

```typescript
import type { LatticeExtension } from '@lattice/lattice';

// Example: localStorage sync extension
const localStorageExtension: LatticeExtension<
  'localStorage',
  <T>(key: string, initialValue: T) => Signal<T>
> = {
  name: 'localStorage',
  method: (key, initialValue) => {
    // Implementation would go here
    return signal(initialValue);
  },
  
  wrap(method, ctx) {
    return (key, initialValue) => {
      if (ctx.isDisposed) {
        throw new Error('Cannot create localStorage signal in disposed context');
      }
      
      const sig = method(key, initialValue);
      
      // Track for cleanup
      ctx.track(sig, 'localStorage');
      
      // Sync with localStorage
      const sync = () => {
        localStorage.setItem(key, JSON.stringify(sig.value));
      };
      
      // Set up effect to sync
      const unsub = subscribe(sig, sync);
      ctx.onDispose(unsub);
      
      return sig;
    };
  }
};

// Use the custom extension
const context = createContext(
  signalExtension,
  subscribeExtension,
  localStorageExtension
);

const theme = context.localStorage('theme', 'light');
```

## Extension Lifecycle

Extensions can hook into the context lifecycle:

```typescript
const myExtension: LatticeExtension<'my', () => void> = {
  name: 'my',
  method: () => console.log('called'),
  
  onCreate(ctx) {
    console.log('Extension added to context');
  },
  
  onDispose(ctx) {
    console.log('Context being disposed');
  },
  
  wrap(method, ctx) {
    return () => {
      console.log('Method called, disposed:', ctx.isDisposed);
      method();
    };
  }
};
```

## Extension Context API

The `ExtensionContext` provides:

- `onDispose(fn)` - Register cleanup functions
- `track(resource, type)` - Track resources for debugging
- `isDisposed` - Check if context is disposed

## Benefits

1. **Tree-Shaking**: Only bundle what you use
2. **Type Safety**: Full TypeScript support
3. **Extensibility**: Easy to add custom functionality
4. **Consistency**: All features use the same pattern
5. **Lifecycle Management**: Proper cleanup and disposal