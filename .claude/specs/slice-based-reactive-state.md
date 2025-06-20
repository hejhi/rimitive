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

#### Dependency Tracking Implementation
```typescript
// Simplified implementation showing key concepts
function createSlice<State, Deps, Computed>(
  depsFn: (selectors: Selectors<State>) => Deps,
  computeFn: (deps: Deps, set: SetState<State>) => Computed
): SliceHandle<Computed> {
  const dependencies = new Set<string>();
  
  // Create tracking-enabled selectors using Object.defineProperty
  let isTracking = true;
  const trackingSelectors = {} as Selectors<State>;
  const actualSelectors = {} as Selectors<State>;
  
  for (const key in state) {
    actualSelectors[key] = createSelector(() => state[key], key);
    
    Object.defineProperty(trackingSelectors, key, {
      get() {
        if (isTracking) {
          dependencies.add(key);
        }
        return actualSelectors[key];
      }
    });
  }
  
  // Track dependencies during this phase
  const deps = depsFn(trackingSelectors);
  isTracking = false;
  
  // Check for composed dependencies
  for (const value of Object.values(deps)) {
    const composedMetadata = getCompositionMetadata(value);
    if (composedMetadata) {
      // Merge dependencies from composed slices
      for (const dep of composedMetadata.dependencies) {
        dependencies.add(dep);
      }
    }
  }
  
  // Create computed values with tracked dependencies
  const computed = computeFn(deps, set);
  
  // Return slice handle with dual functionality
  function slice(): Computed;
  function slice<ChildDeps>(childDepsFn: (parent: Computed) => ChildDeps): ChildDeps;
  function slice<ChildDeps>(childDepsFn?: (parent: Computed) => ChildDeps) {
    if (!childDepsFn) return computed;
    
    // Extract and track composition metadata
    const childDeps = childDepsFn(computed);
    for (const value of Object.values(childDeps)) {
      if (typeof value === 'function') {
        storeCompositionMetadata(value, { slice, dependencies });
      }
    }
    return childDeps;
  }
  
  // Store metadata separately without polluting the API
  storeSliceMetadata(slice, { dependencies, subscribe });
  
  return slice;
}
```

#### Subscription Management
```typescript
// In store implementation
subscribeToKeys(keys: Set<string>, listener: () => void) {
  const wrappedListener = (changedKeys: Set<string>) => {
    // Only notify if our keys changed
    if ([...keys].some(key => changedKeys.has(key))) {
      listener();
    }
  };
  
  this.keyedListeners.add({ keys, listener: wrappedListener });
  
  return () => {
    this.keyedListeners.delete({ keys, listener: wrappedListener });
  };
}
```

## Examples

### Basic Usage
```typescript
// Define products slice
const products = createSlice(
  ({ products }) => ({ products }),
  ({ products }, set) => ({
    all: products,
    byId: (id: string) => products().find(p => p.id === id),
    byCategory: (category: string) => 
      products().filter(p => p.category === category),
    addProduct: (product: Product) => set(
      ({ products }) => ({ products }),
      ({ products }) => ({ products: [...products(), product] })
    ),
    removeProduct: (id: string) => set(
      ({ products }) => ({ products }),
      ({ products }) => ({ products: products().filter(p => p.id !== id) })
    )
  })
);

// Use in component
function ProductList() {
  const allProducts = useSliceSelector(products, 'all');
  return <div>{allProducts.map(p => <Product key={p.id} {...p} />)}</div>;
}
```

### Advanced Composition
```typescript
// Base slices
const products = createSlice(
  ({ products, categories }) => ({ products, categories }),
  ({ products, categories }, set) => ({
    all: products,
    active: () => products().filter(p => p.active),
    byCategory: (cat: string) => products().filter(p => p.category === cat),
    toggleActive: (productId: string) => set(
      ({ products }) => ({ products }),
      ({ products }) => ({
        products: products().map(p => 
          p.id === productId ? { ...p, active: !p.active } : p
        )
      })
    ),
    incrementAllPrices: (amount: number) => set(
      ({ products }) => ({ products }),
      ({ products }) => ({
        products: products().map(p => ({ ...p, price: p.price + amount }))
      })
    )
  })
);

const inventory = createSlice(
  ({ stock }) => ({ stock }),
  ({ stock }, set) => ({
    levels: stock,
    isInStock: (productId: string) => (stock()[productId] || 0) > 0,
    updateStock: (productId: string, quantity: number) => set(
      ({ stock }) => ({ stock }),
      ({ stock }) => ({ stock: { ...stock(), [productId]: quantity } })
    ),
    adjustStock: (productId: string, delta: number) => set(
      ({ stock }) => ({ stock }),
      ({ stock }) => ({
        stock: {
          ...stock(),
          [productId]: (stock()[productId] || 0) + delta
        }
      })
    )
  })
);

// Composed slice - combines products with inventory
const shopProducts = products(
  ({ all, active }) => ({
    all,
    active,
    ...inventory(({ levels, isInStock, updateStock }) => ({ levels, isInStock, updateStock }))
  }),
  ({ all, active, levels, isInStock, updateStock }, set) => ({
    allProducts: all,
    activeProducts: active,
    stockLevels: levels,
    inStock: () => active().filter(p => isInStock(p.id)),
    outOfStock: () => active().filter(p => !isInStock(p.id)),
    restockAll: () => set(
      ({ stock, products }) => ({ stock, products }),
      ({ stock, products }) => {
        const outOfStockIds = products()
          .filter(p => p.active && !stock()[p.id])
          .map(p => p.id);
        const newStock = { ...stock() };
        outOfStockIds.forEach(id => { newStock[id] = 100; });
        return { stock: newStock };
      }
    )
  })
);

// Further composition
const analytics = shopProducts(
  ({ inStock, outOfStock }) => ({ inStock, outOfStock }),
  ({ inStock, outOfStock }, set) => ({
    stockStatus: () => ({
      available: inStock().length,
      unavailable: outOfStock().length,
      percentage: (inStock().length / (inStock().length + outOfStock().length)) * 100
    }),
    logAnalytics: () => set(
      ({ analyticsLog }) => ({ analyticsLog, inStock, outOfStock }),
      ({ analyticsLog, inStock, outOfStock }) => ({
        analyticsLog: [...(analyticsLog() || []), {
          available: inStock().length,
          unavailable: outOfStock().length,
          timestamp: Date.now()
        }]
      })
    )
  })
);
```

### Real-World E-commerce Example
```typescript
// Root slices
const catalog = createSlice(
  ({ products, categories, brands }) => ({ products, categories, brands }),
  ({ products, categories, brands }, set) => ({
    products: products,
    categories: categories,
    brands: brands,
    productsByBrand: (brandId: string) => 
      products().filter(p => p.brandId === brandId),
    addBrand: (brand: Brand) => set(
      ({ brands }) => ({ brands }),
      ({ brands }) => ({ brands: [...brands(), brand] })
    )
  })
);

const pricing = catalog(
  ({ products }) => ({ products }),
  ({ products }, set) => ({
    withTax: (taxRate: number) => 
      products().map(p => ({ ...p, finalPrice: p.price * (1 + taxRate) })),
    discounted: (discount: number) => 
      products().map(p => ({ ...p, salePrice: p.price * (1 - discount) })),
    applyGlobalDiscount: (discount: number) => set(
      ({ products }) => ({ products }),
      ({ products }) => ({
        products: products().map(p => ({ ...p, price: p.price * (1 - discount) }))
      })
    )
  })
);

// Cart slice that composes with pricing
const cart = pricing(
  ({ withTax }) => ({
    withTax,
    cartItems: selectors.cartItems  // Access cart-specific state via selectors
  }),
  ({ withTax, cartItems }, set) => ({
    items: cartItems,
    total: () => {
      const prices = withTax(0.08); // 8% tax
      return cartItems().reduce((sum, item) => {
        const product = prices.find(p => p.id === item.productId);
        return sum + (product?.finalPrice || 0) * item.quantity;
      }, 0);
    },
    addItem: (productId: string, quantity: number) => set(
      ({ cartItems }) => ({ cartItems }),
      ({ cartItems }) => ({
        cartItems: [...cartItems(), { productId, quantity }]
      })
    ),
    clearCart: () => set(
      ({ cartItems }) => ({ cartItems }),
      ({ cartItems }) => ({ cartItems: [] })
    )
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