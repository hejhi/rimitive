# Adapter Architecture Specification

## Overview

Adapters bridge Lattice's slice-based specifications with runtime state management libraries. They make models and slices reactive, enabling the "everything is a slice" architecture.

## Core Concepts

### Composition vs Runtime

- **Composition Time**: Building behavior specifications as factory closures
- **Runtime**: Executing factories with actual state management tools
- **Boundary**: Components return slice factories that await runtime execution

### Slice-Based Execution

In the slice architecture, execution is simpler:

```
component() → model({ set, get }) → slices(model) → reactive stores
```

Everything is a slice - a selector function that projects from the model.

## Execution Model

Adapters receive slice specifications and make them reactive:

```typescript
const spec = component();
// Spec contains:
// - model: factory for creating state
// - actions: slice selecting methods 
// - views: slices or computed view functions
```

## Adapter Primitives

Adapters provide just two core primitives:

```typescript
interface AdapterPrimitives {
  // Create a reactive store from model
  createStore<T>(initial: T): Store<T>;
  
  // Create a reactive slice from a store
  createSlice<T, U>(store: Store<T>, selector: (state: T) => U): Store<U>;
}

interface Store<T> {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(listener: (value: T) => void): () => void;
  destroy?: () => void;
}
```

That's it! Just two functions to make any state management library work with Lattice.

## Implementation Pattern

```typescript
function createAdapter(primitives: AdapterPrimitives) {
  return function executeComponent(componentFactory: ComponentFactory) {
    const spec = componentFactory();
    
    // 1. Create reactive model
    const modelStore = primitives.createStore({});
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => modelStore.set(prev => ({ ...prev, ...updates }))
    });
    modelStore.set(model);
    
    // 2. Create reactive slices
    const actions = primitives.createSlice(modelStore, spec.actions);
    
    // 3. Handle views (static slices or computed functions)
    const views = Object.entries(spec.views).reduce((acc, [key, view]) => {
      if (typeof view === 'function') {
        // Computed view - returns a slice
        acc[key] = () => {
          const innerSlice = view();
          return primitives.createSlice(modelStore, innerSlice);
        };
      } else {
        // Static slice view
        acc[key] = primitives.createSlice(modelStore, view);
      }
      return acc;
    }, {});
    
    return { model: modelStore, actions, views };
  };
}
```

## Example Implementations

### Zustand

```typescript
const zustandPrimitives: AdapterPrimitives = {
  createStore: (initial) => {
    const store = create(() => initial);
    return {
      get: store.getState,
      set: store.setState,
      subscribe: store.subscribe,
      destroy: store.destroy
    };
  },
  
  createSlice: (store, selector) => {
    return {
      get: () => selector(store.get()),
      set: () => {}, // Slices are read-only
      subscribe: (listener) => 
        store.subscribe((state) => listener(selector(state)))
    };
  }
};
```

### Nano Stores

```typescript
const nanoPrimitives: AdapterPrimitives = {
  createStore: (initial) => {
    const store = map(initial);
    return {
      get: () => store.get(),
      set: (value) => store.set(value),
      subscribe: (fn) => store.listen(fn)
    };
  },
  
  createSlice: (store, selector) => {
    const slice = computed([store], () => selector(store.get()));
    return {
      get: () => slice.get(),
      set: () => {}, // Read-only
      subscribe: (fn) => slice.listen(fn)
    };
  }
};
```

## Framework Bindings

Framework bindings remain minimal - they just subscribe and trigger updates:

```typescript
// React
function useSlice<T>(slice: Store<T>): T {
  const [value, setValue] = useState(() => slice.get());
  useEffect(() => slice.subscribe(setValue), [slice]);
  return value;
}

// Vue
function useSlice<T>(slice: Store<T>) {
  const value = ref(slice.get());
  onMounted(() => {
    const unsub = slice.subscribe(v => value.value = v);
    onUnmounted(unsub);
  });
  return value;
}
```

## Design Principles

- **Absolute minimalism**: Just 4 methods (get/set/subscribe/destroy)
- **Everything is a slice**: Unified mental model
- **Native performance**: Libraries use their optimized reactive primitives
- **Adapter freedom**: Each library implements the minimal contract idiomatically
