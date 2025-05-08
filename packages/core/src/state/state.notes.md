# Thinking Through State Composition

## The Problem Space

I'm designing a state composition system that complements the model composition
system with these goals:

1. States are public read-only interfaces to models
2. States can compose other states
3. State properties can reference properties across model and state boundaries
4. Derived properties can be created from dependencies
5. All composition happens before any actual Zustand store is created

Like the model system, this isn't about directly building reactivity - it's
about creating blueprints for the public API that will be backed by Zustand
stores.

## Key Insight: State as Public API Layer

State serves as the public, read-only interface to models. The key insights are:

1. States are functions that return selector creators
2. Selector creators define read-only properties derived from models
3. State composition creates a unified public API that maintains the appropriate
   references

While models define the complete behavior and internal state, states expose only
what should be public to consumers, allowing for a clean separation of concerns.

## Relationship Between State and Model

The state-model relationship is key to this architecture:

1. Models contain both state and behavior
2. States expose selective read-only views of the model
3. State selectors can derive new values from model properties
4. Multiple states can derive different views of the same model

This creates a clean separation between internal implementation (models) and
public API (states).

## Key Questions

### State Derivation

- How should state properties derive values from models?
- What's the best pattern for transparent memoization of derived values?
- How do we handle dependencies between derived values?

### Composition Patterns

- What patterns should we use for composing states from other states?
- How do we preserve property references through composition?
- What's the right balance between flexibility and simplicity?

### Type System Design

The type system for state should:

1. Preserve model-state relationships in the type system
2. Allow for type-safe composition of multiple states
3. Infer property types from the underlying models
4. Provide clear type errors when composition is invalid

## Approach Ideas

### Selector Creation

For state selectors, we need:

1. A way to reference model properties (direct selectors)
2. A way to derive new values from model properties (derived selectors)
3. A memoization strategy for derived selectors

### State Composition

State composition should:

1. Allow combining multiple states while preserving each state's interface
2. Provide a clean way to rename or remap properties during composition
3. Support selective inclusion of properties (narrowing the interface)

### Derived Properties

Derived properties should:

1. Define transformation functions that compute new values from model/state
   properties
2. Automatically track dependencies for efficient updates
3. Provide a clean, declarative API for defining derivations

## Test Cases to Consider

1. **Direct state selection** - Expose model property directly
2. **Derived state** - Compute new value from one or more model properties
3. **Chained derivation** - Derive state from other derived state
4. **Cross-boundary derivation** - Derive state using properties from multiple
   models
5. **State composition** - Combine multiple states into a unified interface

## Implementation Challenges

- **Memoization strategy** - Ensuring derived values are only recomputed when
  dependencies change
- **Dependency tracking** - Automatically detecting dependencies without manual
  declarations
- **Type inference** - Providing comprehensive type information without verbose
  annotations

## Initial Mental Model

States are read-only projections of models that form the public API. They allow
for selective exposure, property transformation, and interface narrowing while
maintaining all the type safety and compositional benefits of the model system.

```
createState(baseState?, ({ state, select })? => ({
  // Select properties from existing states
  count: select(state, "count"),
  status: select(baseState, "status")
}))(({ derive }) => ({
  // Derive new properties from models
  doubled: derive(model, "count", count => count * 2),
  // Or from other state properties
  isActive: derive(state, "status", status => status === "active")
}))
```

This pattern mirrors the model composition system while focusing specifically on
the public, read-only interface to the application state.
