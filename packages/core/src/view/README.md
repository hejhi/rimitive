# View System

## Overview

The View System is a core component of Lattice that provides a structured way to
define UI prop projections for components. Built as a complementary layer to the
State System, it enables creating ready-to-spread UI props and event handlers
using the same powerful fluent composition pattern, emphasizing modularity, type
safety, and developer experience.

## Purpose

The View System serves several key purposes in Lattice:

1. **UI Integration** - Create ready-to-spread props for UI components
2. **Fluent Composition** - Combine multiple view projections using a chainable
   API
3. **State Derivation** - Reference and transform data from finalized states
4. **Action Dispatching** - Connect UI events to actions through a clean
   interface
5. **Type Safety** - Provide comprehensive TypeScript type support throughout
   the view hierarchy
6. **Accessibility Support** - Enable proper management of ARIA props

## Architecture

The View System is designed around the same "fluent composition" pattern as
models and states - views are composable units that can be combined through a
chainable API before finalization. This architecture has several key components:

```
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│      View Factory      │──creates────▶│     View Instance     │──┐
│   (Prop Definition)    │              │   (UI Prop Props)     │  │
│                        │              │                       │  │
└────────────────────────┘              └───────────────────────┘  │
                                                                   │.with()
                                                                   │
                                                                   ▼
┌────────────────────────┐              ┌───────────────────────┐
│                        │              │                       │
│    Component Props     │◀──creates────│    Finalized View     │◀─────.create()
│   (Ready to Spread)    │              │   (Final Props)       │
│                        │              │                       │
└────────────────────────┘              └───────────────────────┘
```

### Key Components

1. **View Factory** - Functions that define the shape and behavior of UI prop
   projections
2. **View Instance** - A composable view projection created by a view factory
   with `.with()` method
3. **Fluent View Composition** - The process of combining views using the
   chainable `.with()` API
4. **View Finalization** - Converting a composed view into its final form using
   `.create()`
5. **State Derivation** - Accessing finalized state properties through a
   `derive()` helper
6. **Action Dispatching** - Connecting UI events to actions through a
   `dispatch()` helper

### Composition and Finalization

The View System follows the same workflow as the Model and State Systems:

1. Create base views using `createView()`
2. Compose views using the fluent `.with()` method
3. Finalize the composition with `.create()`
4. Use the finalized view in UI components

```typescript
// Base view
const counterView = createView(({ derive, dispatch }) => ({
   "data-count": derive(finalizedState, "count"),
   "aria-live": "polite",
   onClick: dispatch(actions, "increment"),
}));

// Extensions express what they're adding to the view
const withAccessibility = counterView.with(({ derive }) => ({
   "aria-label": derive(
      finalizedState,
      "count",
      (count) => `Count is ${count}`,
   ),
   role: "button",
}));

const withStyling = withAccessibility.with(({ derive }) => ({
   className: derive(
      finalizedState,
      "count",
      (count) => count > 0 ? "counter positive" : "counter zero",
   ),
}));

// Create the finalized view
const appView = withStyling.create();
```

### Views, States, and Actions Relationship

A critical aspect of this architecture is the relationship between views,
states, and actions:

```
┌───────────────┐           ┌───────────────┐
│    State A    │─────┐     │    State B    │
│  (Read-only)  │     │     │  (Read-only)  │
└───────────────┘     │     └───────────────┘
       │              │            │
       └──────────────┼────────────┘
                      │
  ┌──────────────────────────────────┐      ┌───────────────┐
  │         Unified Store            │      │   Actions     │
  └──────────────────────────────────┘      │  (Behavior)   │
                 ▲                          └───────────────┘
                 │                                  │
        ┌────────┴────────┐                         │
        │                 │                         │
┌───────────────┐  ┌───────────────┐                │
│    View A     │  │    View B     │                │
│  (UI Props)   │  │  (UI Props)   │                │
└───────────────┘  └───────────────┘                │
        │                 │                         │
        └────────────────┬─────────────────────────┘
                         │
                         ▼
              ┌───────────────────┐
              │  UI Components    │
              │ (React, Vue, etc) │
              └───────────────────┘
```

While states provide read-only data access and actions define behaviors, views
transform this into UI-ready props that components can directly spread into
their JSX/template.

## Key Features

### Fluent Composition API

The `.with()` method provides a clear, chainable API for view composition that:

- Makes composition intent explicit
- Improves code readability
- Preserves type information throughout the chain

### View Finalization

The `.create()` method marks the end of the composition phase by:

- Validating the view for correctness
- Preventing further composition
- Creating a distinct finalized view type

### State Derivation

The `derive()` helper function allows views to reference and transform
properties from finalized states, creating UI props that dynamically reflect
application state:

```typescript
const view = createView(({ derive }) => ({
   "data-count": derive(state, "count"),
   className: derive(
      state,
      "isActive",
      (isActive) => isActive ? "active" : "inactive",
   ),
}));
```

### Action Dispatching

The `dispatch()` helper connects UI events to actions:

```typescript
const view = createView(({ dispatch }) => ({
   onClick: dispatch(actions, "increment"),
   onKeyDown: (e) => {
      if (e.key === "Enter") dispatch(actions, "increment")();
   },
}));
```

### Type System

The type system ensures:

- Type information is preserved across view boundaries
- Event handlers are correctly typed for their actions
- Complete types are inferred without explicit annotations

### Compositional Approach

Like the model and state systems, the view system doesn't directly create UI
components - it creates composable UI prop projections that serve as
ready-to-spread props. This separation allows for:

- Clean separation between logic and presentation
- Reusable UI prop collections
- Flexible composition patterns

## Module Structure

- **create.ts** - Functions for creating and composing view instances
- **identify.ts** - Utilities for identifying valid Lattice views
- **types.ts** - TypeScript type definitions
- **index.ts** - Public API exports

## Design Principles

1. **UI Integration** - Views provide ready-to-spread props for UI components
2. **Event Handling** - Clean pattern for connecting UI events to actions
3. **Fluent Composition** - Chainable, expressive API for combining views
4. **Clear Phase Boundaries** - Distinct composition and finalization phases
5. **Type Safety First** - Comprehensive TypeScript support for developer
   experience
6. **Accessibility Support** - ARIA props can be properly managed
7. **State Derivation** - Views can derive UI props from finalized states
