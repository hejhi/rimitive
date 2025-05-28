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

## Execution Model

Adapters receive executable specifications and provide reactive primitives:

```typescript
const spec = component.getSpec();
// Spec contains factory functions ready for execution with adapter primitives
```


## Adapter Primitives

Adapters provide three core primitives:

```typescript
interface AdapterPrimitives {
  // Create a reactive value
  atom<T>(initial: T): {
    get(): T;
    set(value: T): void;
    subscribe(fn: (value: T) => void): () => void;
  };
  
  // Create a computed value (lazy or reactive)
  computed<T>(fn: () => T): {
    get(): T;
    subscribe(fn: (value: T) => void): () => void;
  };
  
  // Run side effects
  effect(fn: () => void | (() => void)): void;
}
```

## Adapter Pattern

Lattice specifications are data. Adapters provide execution:

1. **Specs describe what** - Component behavior as executable schemas
2. **Adapters provide how** - Reactive primitives for execution
3. **Bindings stay thin** - Just subscribe and trigger framework updates


## Design Principles

- **Less is more**: Minimal primitives enable maximum flexibility
- **Specs as data**: Behavior descriptions, not implementations
- **Adapter freedom**: Each library implements primitives idiomatically
