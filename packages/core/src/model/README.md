# Model System

## Overview

The Model System is a core component of Lattice that provides a structured way
to define, compose, and manage application state. Built as an abstraction layer
over Zustand, it enables a powerful fluent composition-based approach to state
management that emphasizes modularity, type safety, and developer experience.

## Purpose

The Model System serves several key purposes in Lattice:

1. **State Slice Definition** - Define reusable state models once and
   instantiate them many times
2. **Fluent Composition** - Combine multiple state models using a chainable API
3. **Cross-Boundary References** - Allow properties to reference each other
   across model boundaries
4. **Type Safety** - Provide comprehensive TypeScript type support throughout
   the model hierarchy
5. **Store Integration** - Seamlessly integrate with Zustand stores

## Architecture

The Model System is designed around the concept of "fluent model composition" -
the idea that models are composable units for Zustand stores that can be
combined through a chainable API before finalization. This architecture has
several key components:

```
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│      Model Factory     │──creates────▶│    Model Instance     │──┐
│   (State Definition)   │              │    (State Slice)      │  │
│                        │              │                       │  │
└────────────────────────┘              └───────────────────────┘  │
                                                                   │
                                                                   │.with()
                                                                   │
                                                                   ▼
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│     Zustand Store      │◀──creates────│   Finalized Model     │◀─────.create()
│  (Runtime Instance)    │              │    (Final State)      │
│                        │              │                       │
└────────────────────────┘              └───────────────────────┘
```

### Key Components

1. **Model Factory** - Functions that define the shape and behavior of state
   models
2. **Model Instance** - A composable state slice created by a model factory with
   `.with()` method
3. **Fluent Model Composition** - The process of combining models using the
   chainable `.with()` API
4. **Model Finalization** - Converting a composed model into its final form
   using `.create()`
5. **Slice Creator** - A function that instantiates a state slice when called by
   Zustand

### Composition and Finalization

The Model System follows a clear workflow:

1. Create base models using `createModel()`
2. Compose models using the fluent `.with()` method
3. Finalize the composition with `.create()`
4. Use the finalized model in the application

```typescript
// Base model
const counterModel = createModel(() => ({
   count: 10,
}));

// Extensions express what they're adding to the model
const withStats = counterModel.with(({ get }) => ({
   doubleCount: () => get().count * 2,
}));

const withLogger = withStats.with(({ get }) => ({
   logCount: () => console.log(`Current count: ${get().count}`),
}));

// Create the finalized model
const appModel = withLogger.create();
```

### Many Models, One Store

A critical aspect of this architecture is the many-to-one relationship between
models and the final Zustand store:

```
┌───────────┐    
│  Model A  │──┐    
└───────────┘  │.with()    
                │    
                ▼    
           ┌───────────┐
           │  Model B  │──┐
           └───────────┘  │.with()
                          │
                          ▼
                     ┌───────────┐
                     │  Model C  │
                     └─────┬─────┘
                           │.create()
                           ▼
                ┌────────────────────────────┐
                │                            │
                │      Unified Zustand       │
                │          Store             │
                │                            │
                └────────────────────────────┘
```

## Key Features

### Fluent Composition API

The `.with()` method provides a clear, chainable API for model composition that:

- Makes composition intent explicit
- Improves code readability
- Preserves type information throughout the chain

### Model Finalization

The `.create()` method marks the end of the composition phase by:

- Validating the model for correctness
- Preventing further composition
- Creating a distinct finalized model type

### Property Reference Preservation

The system preserves property references across model boundaries through
Zustand's `get()` function, allowing models to access properties defined in
other models.

### Type System

The type system ensures:

- Type information is preserved across model boundaries
- Properties from all composed models are accessible via `get()`
- Complete types are inferred without explicit annotations

### Compositional Approach

The model system doesn't directly create reactive state - it creates composable
state slices that Zustand uses to instantiate reactive state. This separation
allows for:

- Predictable composition
- Preserved property references
- Clear mental model

## Module Structure

- **create.ts** - Functions for creating and composing model instances
- **identify.ts** - Utilities for identifying valid Lattice models
- **types.ts** - TypeScript type definitions
- **index.ts** - Public API exports

## Design Principles

1. **Fluent Composition** - Chainable, expressive API for combining models
2. **Composition Over Inheritance** - Models compose other models rather than
   inheriting from them
3. **Clear Phase Boundaries** - Distinct composition and finalization phases
4. **Type Safety First** - Comprehensive TypeScript support for developer
   experience
5. **Unified Store Model** - All models contribute to a single Zustand store
6. **Reference Preservation** - Property references work across model boundaries
