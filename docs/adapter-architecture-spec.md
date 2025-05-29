# Adapter Architecture Specification

## Overview

Adapters bridge Lattice's slice-based specifications with runtime state management libraries. They make models and slices reactive, enabling the "everything is a slice" architecture.

## Adapter Responsibilities

Adapters have three primary responsibilities:

1. **Execute Slice Factories**: Transform slice factory specifications into reactive stores
2. **Process select() Markers**: Resolve slice references marked with `select()` during composition
3. **Provide Runtime Primitives**: Supply the minimal set of reactive primitives needed for execution

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

### The select() Marker System

The `select()` function is a composition-time marker that indicates a slice reference:

```typescript
// During composition
const actions = createSlice(model, (m) => ({
  increment: m.increment
}));

const button = createSlice(model, (m) => ({
  onClick: select(actions).increment,  // Marks a slice reference
  disabled: m.disabled
}));
```

The `select()` marker:
- **Returns a Symbol** at composition time (not the actual slice)
- **Preserves property access** through a Proxy (e.g., `select(actions).increment`)
- **Gets resolved by adapters** during runtime execution

### Contract Between Core and Adapters

The core-adapter contract is simple but strict:

1. **Core provides**: Slice factory specifications with select() markers
2. **Adapter resolves**: Markers to actual reactive slice references
3. **Result**: Fully reactive, interconnected slice graph

## Execution Model

Adapters receive slice specifications and make them reactive:

```typescript
const spec = component();
// Spec contains:
// - model: factory for creating state
// - actions: slice selecting methods 
// - views: slices or computed view functions
```

## Processing select() Markers

Adapters must resolve select() markers to actual slice values. Here's how:

### 1. Marker Detection

```typescript
function isSelectMarker(value: unknown): boolean {
  return value?.[SELECT_SYMBOL] !== undefined;
}
```

### 2. Marker Resolution

```typescript
function resolveSelectMarkers(obj: any, sliceMap: Map<SliceFactory, Store>): any {
  // Base case: it's a select marker
  if (isSelectMarker(obj)) {
    const { slice, path } = obj[SELECT_SYMBOL];
    const resolvedSlice = sliceMap.get(slice);
    
    // Navigate the path (e.g., select(actions).increment)
    return path.reduce((acc, key) => acc[key], resolvedSlice.get());
  }
  
  // Recursive case: object with potential markers
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] = resolveSelectMarkers(value, sliceMap);
      return acc;
    }, Array.isArray(obj) ? [] : {});
  }
  
  // Base case: primitive value
  return obj;
}
```

### 3. Integration Example

```typescript
function executeSlice(sliceFactory, modelStore, sliceMap, primitives) {
  // Create initial selector
  const selector = (state) => {
    const rawResult = sliceFactory(state);
    // Resolve any select() markers in the result
    return resolveSelectMarkers(rawResult, sliceMap);
  };
  
  // Create reactive slice
  const slice = primitives.createSlice(modelStore, selector);
  
  // Register for future select() references
  sliceMap.set(sliceFactory, slice);
  
  return slice;
}

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
    const sliceMap = new Map<SliceFactory, Store>();
    
    // 1. Create reactive model
    const modelStore = primitives.createStore({});
    const model = spec.model({
      get: () => modelStore.get(),
      set: (updates) => modelStore.set(prev => ({ ...prev, ...updates }))
    });
    modelStore.set(model);
    
    // 2. Execute slices with select() resolution
    function executeSlice(sliceFactory) {
      const selector = (state) => {
        const rawResult = sliceFactory(state);
        return resolveSelectMarkers(rawResult, sliceMap);
      };
      
      const slice = primitives.createSlice(modelStore, selector);
      sliceMap.set(sliceFactory, slice);
      return slice;
    }
    
    // 3. Create reactive slices
    const actions = executeSlice(spec.actions);
    
    // 4. Handle views (static slices or computed functions)
    const views = Object.entries(spec.views).reduce((acc, [key, view]) => {
      if (typeof view === 'function') {
        // Computed view - returns a slice factory
        acc[key] = () => {
          const innerSlice = view();
          return executeSlice(innerSlice);
        };
      } else {
        // Static slice view
        acc[key] = executeSlice(view);
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

## Complete Example: select() in Action

Here's a full example showing how select() markers flow through the system:

```typescript
// 1. Component definition with select()
const todoApp = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    todos: [],
    filter: 'all',
    addTodo: (text) => set({ todos: [...get().todos, { id: Date.now(), text }] }),
    setFilter: (filter) => set({ filter })
  }));
  
  // Actions slice
  const actions = createSlice(model, (m) => ({
    addTodo: m.addTodo,
    setFilter: m.setFilter
  }));
  
  // Filter slice using select()
  const filterButton = createSlice(model, (m) => ({
    onClick: select(actions).setFilter,  // select() marker
    currentFilter: m.filter
  }));
  
  return { model, actions, views: { filterButton } };
});

// 2. Adapter processes the component
const adapter = createZustandAdapter();
const { views } = adapter(todoApp);

// 3. What happens internally:
// - filterButton slice is created with select(actions).setFilter
// - Adapter detects the select() marker
// - Resolves it to the actual actions slice
// - Creates reactive connection

// 4. Result: fully reactive slice
views.filterButton.get();
// Returns: { onClick: [Function: setFilter], currentFilter: 'all' }
// The onClick is the actual method from the actions slice
```

## Design Principles

- **Absolute minimalism**: Just 4 methods (get/set/subscribe/destroy)
- **Everything is a slice**: Unified mental model
- **Native performance**: Libraries use their optimized reactive primitives
- **Adapter freedom**: Each library implements the minimal contract idiomatically
- **Transparent resolution**: select() markers are resolved seamlessly

## Summary

Adapters are the bridge between Lattice's compositional world and the runtime world:

1. **They execute slice factories** - Transform specifications into reactive stores
2. **They resolve select() markers** - Connect slices through symbolic references
3. **They provide minimal primitives** - Just createStore and createSlice

The beauty is in the simplicity: adapters don't need to understand component structure, just how to make slices reactive and resolve their interconnections. This clean separation enables Lattice's "write once, use anywhere" promise.
