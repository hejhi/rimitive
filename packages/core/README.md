# @lattice/core

The core runtime and API for Lattice - a headless component framework for building reusable UI behaviors.

## Installation

```bash
npm install @lattice/core
```

## Overview

`@lattice/core` provides the fundamental building blocks for creating behavior specifications that work across any UI framework:

- **Models** - Encapsulate state and business logic
- **Selectors** - Provide read-only access to state with computed values
- **Actions** - Define pure intent functions that delegate to models
- **Views** - Generate framework-agnostic UI attributes
- **Components** - Compose the above into reusable behavior specifications

## Core APIs

### `createModel`

Creates a model that encapsulates state and business logic:

```typescript
import { createModel } from '@lattice/core';

const counterModel = createModel<{ count: number; increment: () => void }>(
  ({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
    reset: () => set({ count: 0 })
  })
);
```

Models can also use enhancers for advanced patterns:

```typescript
const enhancedModel = createModel<State>(/* factory */).with(derive, combine);
```

### `from()` - Fluent Composition API

The `from()` API enables creating selectors and actions from models:

```typescript
import { from } from '@lattice/core';

// Create selectors with computed values
const selectors = from(model).createSelectors(({ model }) => ({
  count: model().count,
  doubled: model().count * 2,
  isPositive: model().count > 0,
  // Function selectors for runtime computation
  isGreaterThan: (n: number) => model().count > n
}));

// Create actions that delegate to model methods
const actions = from(model).createActions(({ model }) => ({
  increment: model().increment,
  decrement: model().decrement,
  reset: model().reset,
  // Actions can compose multiple operations
  incrementTwice: () => {
    model().increment();
    model().increment();
  }
}));
```

### `project()` - View Creation API

Creates views that transform selectors and actions into UI attributes:

```typescript
import { project } from '@lattice/core';

// Simple view
const buttonView = project(selectors, actions).toView(
  ({ selectors, actions }) => () => ({
    'data-count': selectors().count,
    'aria-label': `Count: ${selectors().count}`,
    onClick: actions().increment
  })
);

// Parameterized view
const nodeView = project(selectors, actions).toView(
  ({ selectors, actions }) => (nodeId: string) => ({
    'aria-selected': selectors().isSelected(nodeId),
    'aria-expanded': selectors().isExpanded(nodeId),
    onClick: () => actions().toggleNode(nodeId)
  })
);
```

### `createComponent`

Composes models, selectors, actions, and views into a complete behavior specification:

```typescript
import { createComponent } from '@lattice/core';

const counter = createComponent(() => {
  const model = counterModel;
  const selectors = from(model).createSelectors(/* ... */);
  const actions = from(model).createActions(/* ... */);
  const view = project(selectors, actions).toView(/* ... */);
  
  return { model, selectors, actions, views: { button: view } };
});
```

### `withComponent` - Component Composition

Enhance existing components with additional functionality:

```typescript
import { withComponent } from '@lattice/core';

const enhancedCounter = createComponent(
  withComponent(counter, ({ model, selectors, actions, views }) => {
    // Extend the model with new state
    const enhancedModel = createModel<ExtendedState>(tools => ({
      ...model()(tools),
      history: [],
      addToHistory: (value) => tools.set(state => ({
        history: [...state.history, value]
      }))
    }));
    
    // Return enhanced slices
    return {
      model: enhancedModel,
      selectors: from(enhancedModel).createSelectors(/* ... */),
      actions: from(enhancedModel).createActions(/* ... */),
      views: { /* enhanced views */ }
    };
  })
);
```

## Enhancers

Lattice provides powerful enhancers for advanced composition patterns:

### `derive` - Computed Values

Create memoized computed values from state:

```typescript
const selectors = from(model.with(derive)).createSelectors(
  ({ model }, { derive }) => ({
    // Direct state access
    items: model().items,
    
    // Derived computation
    expensiveTotal: derive(
      () => model().items,
      (items) => items.reduce((sum, item) => sum + item.price, 0)
    )
  })
);
```

### `combine` - Multi-Source Computation

Combine multiple state values for complex computations:

```typescript
const selectors = from(model.with(combine)).createSelectors(
  ({ model }, { combine }) => ({
    summary: combine(
      () => model().count,
      () => model().items,
      () => model().filter,
      (count, items, filter) => ({
        total: count,
        filtered: items.filter(item => item.name.includes(filter)),
        isEmpty: count === 0
      })
    )
  })
);
```

## Type Safety

Lattice is built with TypeScript-first design, providing:

- Full type inference for all APIs
- Type-safe composition across boundaries
- Compile-time validation of component contracts
- Branded types to prevent incorrect usage

## Factory Pattern

All Lattice APIs follow a factory-of-factories pattern:

1. **Outer Factory**: Defines the specification/contract
2. **Inner Factory**: Executes with runtime tools (provided by adapters)

This separation enables:
- Framework-agnostic behavior definitions
- Type-safe contracts without runtime dependencies
- Clean separation between specification and implementation

## Integration with Store Adapters

Lattice components are specifications that need a store adapter to run:

```typescript
import { createZustandAdapter } from '@lattice/zustand';

// Create a component (specification)
const myComponent = createComponent(/* ... */);

// Create a store adapter (runtime)
const store = createZustandAdapter(myComponent);

// Access the runtime API
const selectors = store.getSelectors();
const actions = store.getActions();
const views = store.getViews();
```

## Best Practices

1. **Keep Models Focused**: Each model should have a single responsibility
2. **Actions are Intent**: Actions should only express what to do, not how
3. **Selectors are Read-Only**: Never mutate state in selectors
4. **Views are Pure**: View factories should be pure functions
5. **Compose, Don't Inherit**: Use `withComponent` for extension

## API Reference

For detailed API documentation, see the [specification](../../docs/spec.md).

## License

MIT