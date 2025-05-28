# Adapter Architecture Specification

## Overview

Adapters bridge Lattice's compositional specifications with runtime state management libraries. They execute specifications in layers, threading reactivity through the entire pipeline.

## Core Concepts

### Composition vs Runtime

- **Composition Time**: Building behavior specifications as factory closures
- **Runtime**: Executing factories with actual state management tools
- **Boundary**: `component.getSpec()` returns deferred factories that capture their context but await runtime tools

### Layered Execution

Each layer partially executes and reveals the next interface:

```
         ┌─> selectors(model) ─┐
getSpec() → model({ set, get }) ─┤                       ├─> views({ selectors, actions })
         └─> actions(model) ───┘
```

## Pipeline Architecture

### Layer 1: Specification Retrieval
```typescript
const spec = component.getSpec();
// Returns: { model, selectors, actions, views } as factory closures
// These capture their enhancers/context but haven't been called yet
```

### Layer 2: Model Hydration
```typescript
const store = createStore((set, get) => {
  return spec.model({ set, get });
});
```
Model factory executes with runtime tools, returns state + methods.

### Layer 3: Model Transformation
```typescript
const modelWithReactivity = transformStore(store);
```
Wraps store to provide consistent interface for subsequent layers.

**Implementation approach**: Use getter proxies for fresh state access:
```typescript
const transformStore = (store) => ({
  get count() { return store.getState().count; },
  get doubled() { return store.getState().doubled; },
  increment: store.getState().increment
});
```

### Layer 4: Selector Execution
```typescript
const selectors = spec.selectors(modelWithReactivity);
```
Selectors build computed values using the reactive model.

### Layer 5: Action Execution
```typescript
const actions = spec.actions(modelWithReactivity);
```
Actions bind to model methods with current state access.

### Layer 6: View Execution
```typescript
const views = spec.views({ selectors, actions });
```
Views create UI attribute factories from selectors and actions.

## Reactivity Threading

State access threads through all layers with two distinct patterns:

**Lazy Computation** (pull-based):
- Model's `compute()` - Recomputes on access when dependencies change
- Memoized but not reactive

**Reactive Binding** (push-based):
- Selector's `select()` - Updates when source changes
- View's `derive()` - Updates when any dependency changes
- Triggers re-renders in UI frameworks

## Adapter Requirements

Adapters provide seven core primitives:

```typescript
interface AdapterRequirements {
  // Store operations
  createStore: (initial?: any) => Store;
  get: () => State;
  set: (updates: Partial<State>) => void;
  subscribe: (listener: () => void) => Unsubscribe;
  destroy?: () => void;
  
  // Computation primitives
  createComputed: <T>(fn: () => T) => () => T;           // Lazy, memoized
  createReactive: <S, T>(                               // Reactive binding
    selector: () => S,
    transform: (selected: S) => T
  ) => () => T;
}
```

## Adapter Responsibilities

1. **Provide primitives** - The seven core operations above
2. **Execute specifications** - Let Lattice orchestrate, adapter provides capabilities
3. **Expose idiomatic API** - Match the patterns of the target library

## Layer Return Types

Each layer produces specific outputs:

- **Model**: State properties, methods, and computed getters
- **Selectors**: Reactive getters that return current values
- **Actions**: Methods that trigger state changes
- **Views**: Factories that produce UI attribute objects

## Open Questions

- **Subscription lifecycle**: When/how do selectors subscribe to model changes?
- **Memoization strategy**: Per-instance or shared across components?
- **Error boundaries**: How to handle errors in the execution pipeline?
- **Type inference**: How to maintain TypeScript inference through transforms?
- **Framework-specific adapter patterns**: React hooks, Vue composables, etc.
