# Adapter Architecture Specification

## Overview

Adapters bridge Lattice's compositional specifications with runtime state management libraries. They execute specifications in layers, threading reactivity through the entire pipeline.

## Core Concepts

### Composition vs Runtime

- **Composition Time**: Building behavior specifications as partially executed factories
- **Runtime**: Executing factories with actual state management tools
- **Boundary**: `component.getSpec()` returns partially executed factories

### Layered Execution

Each layer partially executes and reveals the next interface:

```
getSpec() → model({ set, get }) → selectors(model) → actions(model) → views({ selectors, actions })
```

## Pipeline Architecture

### Layer 1: Specification Retrieval
```typescript
const spec = component.getSpec();
// Returns: { model, selectors, actions, views } as unexecuted factories
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

## Adapter Responsibilities

1. **Execute specifications** with runtime tools
2. **Transform interfaces** between layers
3. **Thread reactivity** through the pipeline
4. **Expose idiomatic API** for the target framework

## Open Questions

- How to safely pass `get()` outside store context?
- Should selectors auto-generate Zustand selectors?
- How to handle subscription/unsubscription?
- Framework-specific adapter patterns (React hooks, Vue composables, etc.)
