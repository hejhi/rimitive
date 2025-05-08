# Model System

## Overview

The Model System is a core component of Lattice that provides a structured way
to define, compose, and manage application state. Built as an abstraction layer
over Zustand, it enables a powerful composition-based approach to state
management that emphasizes modularity, type safety, and developer experience.

## Purpose

The Model System serves several key purposes in Lattice:

1. **State Slice Definition** - Define reusable state models once and
   instantiate them many times
2. **Composition** - Combine multiple state models into a cohesive whole
3. **Cross-Boundary References** - Allow properties to reference each other
   across model boundaries
4. **Type Safety** - Provide comprehensive TypeScript type support throughout
   the model hierarchy
5. **Store Integration** - Seamlessly integrate with Zustand stores

## Architecture

The Model System is designed around the concept of "state slice composition" -
the idea that models are composable units for Zustand stores that can be
combined before instantiation. This architecture has several key components:

```
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│      Model Factory     │──creates────▶│    Model Instance     │
│   (State Definition)   │              │    (State Slice)      │
│                        │              │                       │
└────────────────────────┘              └───────────┬───────────┘
                                                    │
                                                    │compose
                                                    │
                                                    ▼
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│     Zustand Store      │◀───creates───│   Composed Models     │
│  (Runtime Instance)    │              │ (Combined State)      │
│                        │              │                       │
└────────────────────────┘              └───────────────────────┘
```

### Key Components

1. **Model Factory** - Functions that define the shape and behavior of state
   models
2. **Model Instance** - A composable state slice created by a model factory
3. **Model Composition** - The process of combining multiple model instances
4. **Slice Creator** - A function that instantiates a state slice when called by
   Zustand

### Many Models, One Store

A critical aspect of this architecture is the many-to-one relationship between
models and the final Zustand store:

```
┌───────────┐    ┌───────────┐    ┌───────────┐
│  Model A  │    │  Model B  │    │  Model C  │
└─────┬─────┘    └─────┬─────┘    └─────┬─────┘
      │                │                │
      └────────┬───────┴────────┬───────┘
               │                │
               ▼                ▼
         ┌────────────────────────────┐
         │                            │
         │      Unified Zustand       │
         │          Store             │
         │                            │
         └────────────────────────────┘
```

## Key Features

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

- **create.ts** - Functions for creating model instances
- **compose.ts** - Functions for composing model instances
- **identify.ts** - Utilities for identifying valid Lattice models
- **types.ts** - TypeScript type definitions
- **index.ts** - Public API exports

## Design Principles

1. **Composition Over Implementation** - Focus on defining how models should
   compose when instantiated
2. **Composition Over Inheritance** - Models compose other models rather than
   inheriting from them
3. **Type Safety First** - Comprehensive TypeScript support for developer
   experience
4. **Unified Store Model** - All models contribute to a single Zustand store
5. **Reference Preservation** - Property references work across model boundaries
