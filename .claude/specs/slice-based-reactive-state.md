# Slice-Based Reactive State Specification

## Summary

A new API for @lattice/store-react that separates data dependencies from computed values, enabling fine-grained reactive subscriptions and eliminating unnecessary selector executions. Slices explicitly declare their dependencies upfront, allowing the system to build a precise dependency graph for optimal performance.

## Motivation

### Current Problems
- Selectors run on every state change, even for unrelated updates
- No way to know which parts of state a selector depends on
- Performance overhead from running selectors unnecessarily
- Difficult to compose and reuse computed values

### Solution Benefits
- Selectors only run when their declared dependencies change
- Explicit dependency graph enables powerful optimizations
- Clear separation between data access and computation
- Natural composition of slices to build complex state logic

## Design Overview

The core insight is treating state management as a hierarchy of reactive computation nodes rather than just data storage. Each slice declares:
1. **Dependencies**: What data it needs from parent state/slices
2. **Computations**: Derived values computed from those dependencies

This creates a directed acyclic graph where changes propagate only through affected paths.

## Detailed Design

### Core Concepts

#### Slice
A slice is a reactive computation node that:
- Declares dependencies on specific parts of state or other slices
- Provides computed values based on those dependencies
- Can spawn child slices that depend on its computations
- Maintains its own subscribers for fine-grained updates

#### Selector
A function that provides reactive access to a piece of state:
- Always returns the current value when called
- Tracks subscribers interested in changes
- Knows its dependencies for optimal change propagation

#### Dependency Graph
The relationships between slices form a DAG:
```
State (root)
  ├─ products slice (depends on: state.products)
  │   ├─ pricing slice (depends on: products.all)
  │   └─ inventory slice (depends on: products.all, state.stock)
  └─ users slice (depends on: state.users)
      └─ analytics slice (depends on: users.active)
```

### API Design

#### Basic Slice Creation
```typescript
const slice = createSlice<Dependencies, Computations>(
  // Phase 1: Declare dependencies
  (selectors) => ({
    key1: selectors.key1,  // Already a selector
    key2: selectors.key2,  // Already a selector
  }),
  // Phase 2: Define computations and actions
  ({ key1, key2 }, set) => ({
    // Computed values
    computed1: () => key1() + key2(),
    computed2: () => key1() * 2,
    // Actions that modify state using two-phase pattern
    updateKey1: (value: number) => set(
      selectors => selectors,
      state => ({ ...state, key1: value })
    ),
    increment: () => set(
      (selectors) => ({ key1: selectors.key1 }),
      ({ key1 }) => ({ key1: key1() + 1 })
    ),
    incrementBoth: () => set(
      ({ key1, key2 }) => ({ key1, key2 }),
      ({ key1, key2 }) => ({ key1: key1() + 1, key2: key2() + 1 })
    ),
  })
);
```

#### Slice Access and Composition

Slices are functions with dual behavior:

```typescript
// Access mode - call with no arguments to get computed values
const values = slice();
values.increment();
console.log(values.count()); // 5

// Composition mode - call with selector to extract values for other slices
const createSlice = createStore({ products: [], inventory: {} });

const productSlice = createSlice(
  (selectors) => ({ products: selectors.products }),
  ({ products }, set) => ({
    all: () => products(),
    active: () => products().filter(p => p.active),
    toggleActive: (id: string) => set(
      (selectors) => ({ products: selectors.products }),
      ({ products }) => ({
        products: products().map(p => 
          p.id === id ? { ...p, active: !p.active } : p
        )
      })
    )
  })
);

// Compose slices by extracting computed values
const inventorySlice = createSlice(
  (selectors) => ({
    inventory: selectors.inventory,
    // Extract active products from productSlice
    ...productSlice(({ active }) => ({ activeProducts: active }))
  }),
  ({ inventory, activeProducts }, set) => ({
    // Use composed values in computations
    inStockActive: () => {
      const inv = inventory();
      return activeProducts().filter(p => inv[p.id] > 0);
    },
    updateStock: (id: string, qty: number) => set(
      (selectors) => ({ inventory: selectors.inventory }),
      ({ inventory }) => ({ 
        inventory: { ...inventory(), [id]: qty } 
      })
    )
  })
);

// Use the slices
const products = productSlice();
products.toggleActive('123');

const inventory = inventorySlice();
console.log(inventory.inStockActive()); // Reactive to both slices
```

#### Type Definitions
```typescript
// Selector that tracks access and provides subscription
type Selector<T> = {
  (): T;
  subscribe: (listener: () => void) => () => void;
};

// Two-phase state setter
type SetState<State> = <Deps>(
  depsFn: (selectors: Selectors<State>) => Deps,
  updateFn: (deps: Deps) => Partial<State>
) => void;

// Slice handle with dual functionality
interface SliceHandle<Computed> {
  // Access mode: returns computed values
  (): Computed;
  // Composition mode: extracts values for other slices
  <ChildDeps>(depsFn: (parent: Computed) => ChildDeps): ChildDeps;
}

// Factory returned by createStore
type ReactiveSliceFactory<State> = <Deps, Computed>(
  depsFn: (selectors: Selectors<State>) => Deps,
  computeFn: (deps: Deps, set: SetState<State>) => Computed
) => SliceHandle<Computed>;

// Metadata access for framework integration (not part of user API)
interface SliceMetadata {
  dependencies: Set<string>;
  subscribe: (listener: () => void) => () => void;
}
```

### Implementation Details

#### Module Architecture

The implementation follows a clean separation of concerns:

1. **User API** (`store.ts`): The main `createStore` function and slice creation
2. **Internal Metadata** (`internal/metadata.ts`): WeakMap-based metadata storage for framework integration
3. **Public Utilities** (`utils.ts`): Controlled access to metadata for testing and dev tools

This design ensures:
- No metadata pollution in user-facing types
- Memory-safe metadata storage with WeakMaps
- Clean API surface without internal implementation details

#### Dependency Tracking Without Proxies
The implementation uses `Object.defineProperty` to create tracking getters instead of Proxies. When selectors are accessed during the dependency phase, the getters record which state keys are used.

#### Fine-Grained Subscription Management
The store tracks listeners by their dependency keys, notifying only those whose dependencies have changed:
- Each slice knows exactly which state keys it depends on
- When state changes, only slices with affected dependencies are notified
- Subscription management happens at the slice level, not the adapter level

## Adapter Integration

### Separation of Concerns

The reactive slice system cleanly separates responsibilities between adapters and Lattice:

#### Adapters Provide:
- **Store Creation**: Initialize the underlying store from initial state
- **Basic Operations**: Simple get/set/subscribe for the entire state model
- **Store Features**: Middleware, devtools, persistence, time-travel, etc.
- **No Slice Knowledge**: Adapters don't need to understand slices or dependencies

#### Lattice Provides:
- **Reactive Layer**: Creates reactive slices on top of any adapter
- **Dependency Tracking**: Manages which slices depend on which state keys
- **Fine-Grained Subscriptions**: Notifies only affected slices when state changes
- **Composition**: Handles slice composition and dependency merging
- **Optimization**: Ensures minimal re-computations and re-renders

### How It Works

```typescript
// 1. Adapter provides basic store operations
const zustandStore = create(...);
const adapter = zustandAdapter(zustandStore);

// 2. Lattice adds reactive layer on top
const createSlice = createLatticeStore(adapter);

// 3. Slices have fine-grained subscriptions
const counterSlice = createSlice(
  (selectors) => ({ count: selectors.count }),
  ({ count }, set) => ({
    value: () => count(),
    increment: () => set(...)
  })
);

// 4. React hooks subscribe to specific slices
const count = useSlice(counterSlice, c => c.value());
// Only re-renders when count changes, not on any state change
```

### Benefits

1. **Universal Optimization**: All stores (Zustand, Redux, etc.) get fine-grained subscriptions
2. **Adapter Simplicity**: Adapters remain simple wrappers around existing stores
3. **Feature Preservation**: Store features like devtools and persistence work unchanged
4. **Clean Architecture**: Clear separation between state storage and reactive computation


## Examples

### Basic Counter
```typescript
const createSlice = createStore({ count: 0 });

const counterSlice = createSlice(
  (selectors) => ({ count: selectors.count }),
  ({ count }, set) => ({
    value: () => count(),
    increment: () => set(
      (selectors) => ({ count: selectors.count }),
      ({ count }) => ({ count: count() + 1 })
    ),
    decrement: () => set(
      (selectors) => ({ count: selectors.count }),
      ({ count }) => ({ count: count() - 1 })
    )
  })
);

// Usage
const counter = counterSlice();
console.log(counter.value()); // 0
counter.increment();
console.log(counter.value()); // 1
```

### Slice Composition
```typescript
const createSlice = createStore({ 
  products: [],
  inventory: {},
  cart: []
});

// Product slice
const productSlice = createSlice(
  (selectors) => ({ products: selectors.products }),
  ({ products }, set) => ({
    all: () => products(),
    active: () => products().filter(p => p.active),
    toggleActive: (id: string) => set(
      (selectors) => ({ products: selectors.products }),
      ({ products }) => ({
        products: products().map(p => 
          p.id === id ? { ...p, active: !p.active } : p
        )
      })
    )
  })
);

// Inventory slice composes with products
const inventorySlice = createSlice(
  (selectors) => ({
    inventory: selectors.inventory,
    // Compose with product slice
    ...productSlice(({ active }) => ({ activeProducts: active }))
  }),
  ({ inventory, activeProducts }, set) => ({
    inStock: () => {
      const inv = inventory();
      return activeProducts().filter(p => inv[p.id] > 0);
    },
    updateStock: (id: string, qty: number) => set(
      (selectors) => ({ inventory: selectors.inventory }),
      ({ inventory }) => ({ 
        inventory: { ...inventory(), [id]: qty } 
      })
    )
  })
);

// Cart slice for UI consumption
const cartSlice = createSlice(
  (selectors) => ({
    cart: selectors.cart,
    ...inventorySlice(({ inStock }) => ({ availableProducts: inStock }))
  }),
  ({ cart, availableProducts }) => ({
    items: () => cart(),
    canAddToCart: (productId: string) => 
      availableProducts().some(p => p.id === productId)
  })
);
```

## Performance Characteristics

### Time Complexity
- **State update**: O(k) where k is number of changed keys
- **Dependency check**: O(1) using Set lookup
- **Selector execution**: Only runs for affected slices
- **Subscription management**: O(s) where s is subscribers to changed keys

### Space Complexity
- **Per slice**: O(d) where d is number of dependencies
- **Per selector**: Minimal overhead for subscription tracking
- **Overall**: Linear with number of slices and their dependencies

### Optimization Opportunities
1. **Memoization**: Can be added at slice level for expensive computations
2. **Batching**: Multiple state updates can be batched before propagation
3. **Lazy evaluation**: Selectors only compute when accessed
4. **Structural sharing**: Unchanged values maintain referential equality

## Module Design

### API Surface

The implementation provides a clean separation between user-facing API and framework/testing utilities:

```typescript
// Main API - @lattice/core
import { createStore } from '@lattice/core';

// Utilities - @lattice/core/utils  
import { getSliceMetadata } from '@lattice/core/utils';
```

### Implementation Architecture

```
packages/core/src/
├── store.ts              # Main createStore implementation
├── internal/
│   └── metadata.ts       # Hidden metadata storage (WeakMaps)
├── utils.ts              # Public utilities for framework integration
└── index.ts              # Clean public API exports
```

### Key Design Decisions

1. **Single createStore Function**: No API fragmentation. Metadata is always stored internally but only exposed through utilities.

2. **Module-scoped WeakMaps**: Metadata storage is completely hidden in `internal/metadata.ts`, preventing any leakage into the public API.

3. **Clean Slice Type**: Slices are pure functions with no visible metadata properties:
   ```typescript
   interface SliceHandle<Computed> {
     (): Computed;                                    // Get computed values
     <ChildDeps>(depsFn: (parent: Computed) => ChildDeps): ChildDeps; // Compose
   }
   ```

4. **Separate Utility Module**: Framework integrations and testing utilities are isolated in a separate import path, keeping the main API uncluttered.

### Usage Patterns

#### Basic Usage (User Code)
```typescript
import { createStore } from '@lattice/core';

const createSlice = createStore({ count: 0 });
const slice = createSlice(
  (selectors) => ({ count: selectors.count }),
  ({ count }, set) => ({
    value: () => count(),
    increment: () => set(
      (selectors) => ({ count: selectors.count }),
      ({ count }) => ({ count: count() + 1 })
    )
  })
);

// Clean API - no metadata visible
slice().increment();
console.log(slice().value()); // 1
```

#### Testing/Framework Integration
```typescript
import { createStore } from '@lattice/core';
import { getSliceMetadata } from '@lattice/core/utils';

const createSlice = createStore({ count: 0, name: 'test' });
const slice = createSlice(
  (selectors) => ({ count: selectors.count }),
  ({ count }, set) => ({ /* ... */ })
);

// Access metadata when needed
const metadata = getSliceMetadata(slice);
console.log(metadata?.dependencies); // Set { 'count' }

// Subscribe to changes
const unsubscribe = metadata?.subscribe(() => {
  console.log('Dependencies changed!');
});
```

### Benefits

1. **Clean Public API**: Users only see what they need - no `_dependencies` or `_subscribe` cluttering the interface
2. **Powerful When Needed**: Full metadata access available for frameworks and tooling
3. **No Backwards Compatibility**: Greenfield design allows for the cleanest possible API
4. **Type Safety**: Full TypeScript support with clean, understandable types
5. **Performance**: WeakMaps ensure automatic cleanup when slices are garbage collected

## Open Questions

1. **Naming**: Is "slice" the best term? Alternatives: segment, projection, view
2. **Async Support**: How to handle async computations? Suspense integration?
3. **DevTools**: How to visualize the dependency graph?
4. **Performance**: Should we add built-in memoization or leave it to users?
5. **Testing**: Best practices for testing composed slices?
6. **Error Handling**: How to handle errors in computed values?
7. **Side Effects**: Should slices support effects or keep them separate?