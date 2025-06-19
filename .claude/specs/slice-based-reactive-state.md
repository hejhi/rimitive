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
  (model) => ({
    key1: model.key1,  // Returns a selector
    key2: model.key2,  // Returns a selector
  }),
  // Phase 2: Define computations using dependencies
  ({ key1, key2 }) => ({
    computed1: () => key1() + key2(),
    computed2: () => key1() * 2,
  })
);
```

#### Slice Composition
```typescript
// Create child slice from parent
const childSlice = parentSlice(
  ({ computed1, computed2 }) => ({ computed1, computed2 }),
  ({ computed1, computed2 }) => ({
    further: () => computed1() + computed2()
  })
);
```

#### Type Definitions
```typescript
type Selector<T> = {
  (): T;
  subscribe: (listener: () => void) => () => void;
  _dependencies: Set<string>;
};

type SliceFactory<Model, Deps, Computed> = {
  (depsFn: (model: Model) => Deps, computeFn: (deps: Deps) => Computed): Slice<Computed>;
};

type Slice<Computed> = Computed & {
  <ChildDeps, ChildComputed>(
    depsFn: (parent: Computed) => ChildDeps,
    computeFn: (deps: ChildDeps) => ChildComputed
  ): Slice<ChildComputed>;
};
```

### Implementation Details

#### Dependency Tracking
```typescript
function createSlice<Model, Deps, Computed>(
  depsFn: (model: Model) => Deps,
  computeFn: (deps: Deps) => Computed
) {
  const dependencies = new Set<string>();
  
  // Proxy to track accessed keys
  const modelProxy = new Proxy(model, {
    get(target, key) {
      dependencies.add(key as string);
      return createSelector(() => target[key], [key]);
    }
  });
  
  // Build dependency model
  const deps = depsFn(modelProxy);
  
  // Create computed values
  const computed = computeFn(deps);
  
  // Subscribe only to relevant changes
  const subscribe = (listener: () => void) => {
    return store.subscribeToKeys(dependencies, listener);
  };
  
  return { ...computed, subscribe, dependencies };
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
  ({ products }) => ({
    all: products,
    byId: (id: string) => products().find(p => p.id === id),
    byCategory: (category: string) => 
      products().filter(p => p.category === category)
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
  ({ products, categories }) => ({
    all: products,
    active: () => products().filter(p => p.active),
    byCategory: (cat: string) => products().filter(p => p.category === cat)
  })
);

const inventory = createSlice(
  ({ stock }) => ({ stock }),
  ({ stock }) => ({
    levels: stock,
    isInStock: (productId: string) => (stock()[productId] || 0) > 0
  })
);

// Composed slice
const shopProducts = products(
  ({ all, active }) => ({ all, active }),
  ({ all, active }, { use }) => ({
    ...use(inventory), // Include inventory methods
    inStock: () => active().filter(p => use(inventory).isInStock(p.id)),
    outOfStock: () => active().filter(p => !use(inventory).isInStock(p.id))
  })
);

// Further composition
const analytics = shopProducts(
  ({ inStock, outOfStock }) => ({ inStock, outOfStock }),
  ({ inStock, outOfStock }) => ({
    stockStatus: () => ({
      available: inStock().length,
      unavailable: outOfStock().length,
      percentage: (inStock().length / (inStock().length + outOfStock().length)) * 100
    })
  })
);
```

### Real-World E-commerce Example
```typescript
// Root slices
const catalog = createSlice(
  ({ products, categories, brands }) => ({ products, categories, brands }),
  ({ products, categories, brands }) => ({
    products: products,
    categories: categories,
    brands: brands,
    productsByBrand: (brandId: string) => 
      products().filter(p => p.brandId === brandId)
  })
);

const pricing = catalog(
  ({ products }) => ({ products }),
  ({ products }) => ({
    withTax: (taxRate: number) => 
      products().map(p => ({ ...p, finalPrice: p.price * (1 + taxRate) })),
    discounted: (discount: number) => 
      products().map(p => ({ ...p, salePrice: p.price * (1 - discount) }))
  })
);

const cart = createSlice(
  ({ cartItems }) => ({ cartItems }),
  ({ cartItems }, { use }) => ({
    items: cartItems,
    total: () => {
      const prices = use(pricing).withTax(0.08); // 8% tax
      return cartItems().reduce((sum, item) => {
        const product = prices().find(p => p.id === item.productId);
        return sum + (product?.finalPrice || 0) * item.quantity;
      }, 0);
    }
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

## Open Questions

1. **Naming**: Is "slice" the best term? Alternatives: segment, projection, view
2. **Async Support**: How to handle async computations? Suspense integration?
3. **DevTools**: How to visualize the dependency graph?
4. **Performance**: Should we add built-in memoization or leave it to users?
5. **Testing**: Best practices for testing composed slices?
6. **Error Handling**: How to handle errors in computed values?
7. **Side Effects**: Should slices support effects or keep them separate?