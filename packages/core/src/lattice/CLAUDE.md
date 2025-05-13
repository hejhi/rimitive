# Lattice Module

This document provides guidance for working with the Lattice module, which is the core integration layer that brings together models, actions, states, and views into cohesive component structures.

## Core Concepts

A **lattice** is both the declarative contract and implementation API for a component:
- It encapsulates model, state, actions, and view components
- It enforces composition boundaries and type safety
- It provides a fluent API for component composition

The key parts of a lattice are:
- **Model**: Internal state and business logic (HOW)
- **Actions**: Pure intent functions for state changes (WHAT)
- **State**: Public selectors for read access
- **Views**: UI attributes mapped from state/actions

## Composition Patterns

### Direct Component Creation

The simplest way to create a lattice is with prepared components:

```typescript
const baseLattice = createLattice({
  model: prepare(counterModel),
  state: prepare(counterState),
  actions: prepare(counterActions),
  view: {
    counter: prepare(counterView),
    button: prepare(buttonView)
  }
});
```

### Lattice Pass-Through Composition

The enhanced API allows passing entire lattices as components:

```typescript
const enhancedLattice = createLattice({
  // New composed model
  model: prepare(composedModel),
  
  // Pass-through - uses state from baseLattice 
  state: baseLattice,
  
  // Pass-through - uses actions from baseLattice
  actions: baseLattice,
  
  // Views can be composed from multiple sources
  view: {
    // New view
    enhancedCounter: prepare(enhancedView),
    
    // Extract specific view from base lattice
    button: use(baseLattice, "button"),
    
    // Spread all views from base lattice
    ...spreadViews(baseLattice)
  }
});
```

## Component Resolution

When creating a lattice, components can be:
1. Prepared instances (model, state, actions, or view)
2. Entire lattices (from which the corresponding component is extracted)

The resolution process:
- For model, state, and actions: Extract directly from the lattice if provided
- For views: Allow extracting specific named views or spreading all views

## View Composition Utilities

Two key utilities for view composition:

1. **`use`**: Extract a specific named view from a lattice
   ```typescript
   const buttonView = use(baseLattice, "button");
   ```

2. **`spreadViews`**: Extract all views from a lattice
   ```typescript
   const allViews = {
     ...spreadViews(baseLattice)
   };
   ```

## Runtime Tools

Lattice implements three core runtime tools:

1. **`derive`**: Creates reactive subscriptions between sources
   ```typescript
   const state = createState(({ derive }) => ({
     count: derive(model, "count"),
     doubled: derive(model, "count", count => count * 2)
   }));
   ```

2. **`dispatch`**: Connects view event handlers to actions
   ```typescript
   const view = createView(({ dispatch }) => ({
     onClick: dispatch(actions, "increment")
   }));
   ```

3. **`mutate`**: Connects actions to model methods
   ```typescript
   const actions = createActions(({ mutate }) => ({
     increment: mutate(model, "increment")
   }));
   ```

### Important Constraints

These tools come with usage constraints:
- `derive` can only be used in state and view creation
- `dispatch` can only be used in view creation
- `mutate` can only be used in actions creation
- They must be called directly as property values, not in nested functions

## Instantiation

Lattices are instantiated for framework-agnostic usage with:

```typescript
const instance = instantiateLattice(lattice, {
  initialState: { count: 5 } // Optional
});

// Access components
const state = instance.getState();
const actions = instance.getActions();
const views = instance.getView();
```

This creates the Zustand store and wires up all reactive relationships.

## Common Patterns and Best Practices

1. **Always prepare components before adding to a lattice**
   ```typescript
   model: prepare(counterModel) // ✓
   model: counterModel // ✗
   ```

2. **Use pass-through when composing with an existing lattice**
   ```typescript
   // Do this
   state: baseLattice
   
   // Not this
   state: prepare(compose(baseLattice.state).with(...))
   ```

3. **Use view utilities for clarity**
   ```typescript
   // Do this
   button: use(baseLattice, "button")
   
   // Not this
   button: baseLattice.view.button
   ```

4. **Create model composition first, then actions and state**
   The dependency flow is: model → actions → state → view

5. **Keep views namespaced for organization**
   ```typescript
   view: {
     counter: prepare(counterView),
     button: prepare(buttonView)
   }
   ```

## Type Safety

The lattice system is designed with type safety in mind:
- Generic type parameters preserve exact types across composition
- Branded types ensure runtime type checking
- Type guards validate components at runtime
- The composition API is fully type-checked

## Implementation Details to Know

1. When passing a lattice for a component, the appropriate component is extracted automatically
2. View components are namespaced within lattices
3. All components must be prepared with `prepare()` before being used in a lattice
4. The branding system ensures components can be identified at runtime
5. Runtime guards prevent misuse of the derive/dispatch/mutate tools