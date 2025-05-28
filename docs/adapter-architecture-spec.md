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

State access (via `get()` or equivalent) threads through all layers:
- Model's `compute()` uses `get()` for derived state
- Selector's `select()` accesses state through the model interface
- Actions reference current state
- View's `derive()` creates reactive UI attributes

**Reactivity mechanism**: Hybrid approach
- **Pull-based** for initial values (via getters)
- **Push-based** for updates (via subscriptions)
- **Lazy evaluation** with memoization for selectors

## Adapter Responsibilities

1. **Execute specifications** with runtime tools
2. **Transform interfaces** between layers
3. **Thread reactivity** through the pipeline
4. **Expose idiomatic API** for the target framework

## Layer Return Types

```typescript
type ModelInstance = { state: any, methods: any, computed: any }
type SelectorsInstance = { [key: string]: () => any }
type ActionsInstance = { [key: string]: (...args) => void }
type ViewsInstance = { [key: string]: (params?) => UIAttributes }
```

## Open Questions

- **Subscription lifecycle**: When/how do selectors subscribe to model changes?
- **Memoization strategy**: Per-instance or shared across components?
- **Error boundaries**: How to handle errors in the execution pipeline?
- **Type inference**: How to maintain TypeScript inference through transforms?
- **Framework-specific adapter patterns**: React hooks, Vue composables, etc.
