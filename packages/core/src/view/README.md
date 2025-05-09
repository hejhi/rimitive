# State System

## Overview

The State System is a core component of Lattice that provides a structured way
to define public projections of application state. Built as a complementary
layer to the Model System, it enables creating read-only views of model data
using the same powerful fluent composition pattern, emphasizing modularity, type
safety, and developer experience.

## Purpose

The State System serves several key purposes in Lattice:

1. **Public API Definition** - Define read-only projections of internal model
   state
2. **Fluent Composition** - Combine multiple state projections using a chainable
   API
3. **Model Derivation** - Reference and transform data from finalized models
4. **Type Safety** - Provide comprehensive TypeScript type support throughout
   the state hierarchy
5. **Encapsulation** - Separate internal mutable state from public read-only
   interfaces

## Architecture

The State System is designed around the same "fluent composition" pattern as
models - states are composable units that can be combined through a chainable
API before finalization. This architecture has several key components:

```
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│      State Factory     │──creates────▶│    State Instance     │──┐
│  (Public Definition)   │              │   (State Projection)  │  │
│                        │              │                       │  │
└────────────────────────┘              └───────────────────────┘  │
                                                                   │.with()
                                                                   │
                                                                   ▼
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│    Public Interface    │◀──creates────│   Finalized State     │◀─────.create()
│   (Runtime Access)     │              │  (Final Projection)   │
│                        │              │                       │
└────────────────────────┘              └───────────────────────┘
```

### Key Components

1. **State Factory** - Functions that define the shape and behavior of public
   state projections
2. **State Instance** - A composable state projection created by a state factory
   with `.with()` method
3. **Fluent State Composition** - The process of combining states using the
   chainable `.with()` API
4. **State Finalization** - Converting a composed state into its final form
   using `.create()`
5. **Model Derivation** - Accessing finalized model properties through a
   `derive()` helper (planned feature)

### Composition and Finalization

The State System follows the same workflow as the Model System:

1. Create base states using `createState()`
2. Compose states using the fluent `.with()` method
3. Finalize the composition with `.create()`
4. Use the finalized state in the application

```typescript
// Base state
const counterState = createState(() => ({
  count: 10,
  isPositive: () => true,
}));

// Extensions express what they're adding to the state
const withStats = counterState.with(({ get }) => ({
  doubleCount: () => get().count * 2,
}));

const withFormatting = withStats.with(({ get }) => ({
  formattedCount: () => `Current count: ${get().count}`,
}));

// Create the finalized state
const appState = withFormatting.create();
```

### States and Models Relationship

A critical aspect of this architecture is the relationship between states and
models:

```
┌───────────────┐           ┌───────────────┐
│   Model A     │─────┐     │   Model B     │
│ (Internal)    │     │     │ (Internal)    │
└───────────────┘     │     └───────────────┘
       │              │            │
       └──────────────┼────────────┘
                      │
  ┌──────────────────────────────────┐      
  │          Unified Store           │      
  └──────────────────────────────────┘      
                 ▲
                 │
        ┌────────┴────────┐
        │                 │
┌───────────────┐  ┌───────────────┐
│   State A     │  │   State B     │
│  (Public)     │  │  (Public)     │
└───────────────┘  └───────────────┘
```

While models define internal mutable state, states provide read-only projections
for public consumption.

## Key Features

### Fluent Composition API

The `.with()` method provides a clear, chainable API for state composition that:

- Makes composition intent explicit
- Improves code readability
- Preserves type information throughout the chain

### State Finalization

The `.create()` method marks the end of the composition phase by:

- Validating the state for correctness
- Preventing further composition
- Creating a distinct finalized state type

### Property Reference Preservation

The system preserves property references across state boundaries through
Zustand's `get()` function, allowing states to access properties defined in
other states.

### Model Derivation (Planned)

A `derive()` helper function will allow states to reference and transform
properties from finalized models, creating a clear relationship between internal
models and public state.

### Type System

The type system ensures:

- Type information is preserved across state boundaries
- Properties from all composed states are accessible via `get()`
- Complete types are inferred without explicit annotations

### Compositional Approach

Like the model system, the state system doesn't directly create reactive state -
it creates composable state projections that serve as public interfaces. This
separation allows for:

- Clear public/private boundaries
- Preserved property references
- Flexible composition patterns

## Module Structure

- **create.ts** - Functions for creating and composing state instances
- **identify.ts** - Utilities for identifying valid Lattice states
- **types.ts** - TypeScript type definitions
- **index.ts** - Public API exports

## Design Principles

1. **Public Interface Separation** - States provide a clear public API for
   models
2. **Read-Only by Default** - States expose read-only projections of internal
   state
3. **Fluent Composition** - Chainable, expressive API for combining states
4. **Clear Phase Boundaries** - Distinct composition and finalization phases
5. **Type Safety First** - Comprehensive TypeScript support for developer
   experience
6. **Reference Preservation** - Property references work across state boundaries
7. **Model Derivation** - States can derive values from finalized models
