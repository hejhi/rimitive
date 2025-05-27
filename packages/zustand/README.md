# @lattice/zustand

Zustand store adapter for Lattice - enables using Lattice behavior specifications with Zustand for state management.

## Installation

```bash
npm install @lattice/zustand zustand @lattice/core
```

## Overview

This adapter bridges Lattice's behavior specifications with Zustand's state management, allowing you to:

- Use Lattice components with Zustand's proven state management
- Access the full Zustand ecosystem (middleware, devtools, persist, etc.)
- Keep your behavior specifications framework-agnostic
- Get type-safe state management out of the box

## Basic Usage

```typescript
import { createComponent, createModel, from, project } from '@lattice/core';
import { createZustandAdapter } from '@lattice/zustand';

// 1. Define your Lattice component
const counter = createComponent(() => {
  const model = createModel<{ count: number; increment: () => void }>(
    ({ set, get }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    })
  );
  
  const selectors = from(model).createSelectors(({ model }) => ({
    count: model().count,
    doubled: model().count * 2
  }));
  
  const actions = from(model).createActions(({ model }) => ({
    increment: model().increment
  }));
  
  const view = project(selectors, actions).toView(
    ({ selectors, actions }) => () => ({
      'data-count': selectors().count,
      onClick: actions().increment
    })
  );
  
  return { model, selectors, actions, views: { button: view } };
});

// 2. Create a Zustand store from your component
const counterStore = createZustandAdapter(counter);

// 3. Use the standardized API
const selectors = counterStore.getSelectors();
const actions = counterStore.getActions();
const views = counterStore.getViews();

console.log(selectors.count); // 0
actions.increment();
console.log(selectors.count); // 1
```

## API Reference

### `createZustandAdapter(componentFactory)`

Creates a Zustand store adapter from a Lattice component factory.

**Parameters:**
- `componentFactory`: A Lattice component factory created with `createComponent()`

**Returns:** A `LatticeAPI` instance with:
- `getSelectors()`: Returns the current selector values
- `getActions()`: Returns the action functions
- `getViews()`: Returns the view factories
- `subscribe(callback)`: Subscribe to state changes
- `destroy()`: Clean up subscriptions

## React Integration

While a dedicated React adapter is coming soon, you can use Zustand's React integration directly:

```tsx
import { useStore } from 'zustand';
import { createZustandAdapter } from '@lattice/zustand';
import { myComponent } from './my-component';

// Create the store once (outside components)
const store = createZustandAdapter(myComponent);

// Create a Zustand React hook
const useMyComponent = create(store);

// Use in React components
function MyComponent() {
  const count = useMyComponent(state => state.selectors.count);
  const increment = useMyComponent(state => state.actions.increment);
  
  return (
    <button onClick={increment}>
      Count: {count}
    </button>
  );
}
```

## Vanilla JavaScript Usage

```javascript
import { createZustandAdapter } from '@lattice/zustand';
import { myComponent } from './my-component';

// Create store
const store = createZustandAdapter(myComponent);

// Subscribe to changes
const unsubscribe = store.subscribe(() => {
  const { count } = store.getSelectors();
  document.getElementById('count').textContent = count;
});

// Use actions
document.getElementById('increment').addEventListener('click', () => {
  const { increment } = store.getActions();
  increment();
});

// Clean up when done
store.destroy();
```

## Advanced Usage

### With Zustand Middleware

You can use Zustand middleware by wrapping the store (coming in future versions):

```typescript
// Future API - not yet implemented
import { devtools, persist } from 'zustand/middleware';

const store = createZustandAdapter(myComponent, {
  middleware: [devtools(), persist('my-component')]
});
```

### Multiple Instances

Each adapter creates an independent store instance:

```typescript
const store1 = createZustandAdapter(counter);
const store2 = createZustandAdapter(counter);

// Independent state
store1.getActions().increment();
console.log(store1.getSelectors().count); // 1
console.log(store2.getSelectors().count); // 0
```

## Type Safety

The adapter preserves all type information from your Lattice components:

```typescript
const store = createZustandAdapter(myTypedComponent);

// Full type inference
const selectors = store.getSelectors(); // Typed selectors
const actions = store.getActions();     // Typed actions
const views = store.getViews();         // Typed views
```

## Limitations

- Zustand middleware integration is not yet implemented
- Direct React hooks are not provided (use Zustand's hooks for now)
- SSR support requires additional setup

## License

MIT