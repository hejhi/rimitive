# Thinking Through Model Composition

## The Problem Space

I'm trying to create a model composition system where:

1. Models are defined once but instantiated many times
2. Models can compose other models
3. Properties can reference each other across model boundaries
4. Property references are preserved through composition layers
5. All of this happens before any actual Zustand store is created

This is fundamentally different from the draft spec's two-phase approach. I'm
thinking about a single function that builds a composition chain, rather than
separate composition and extension phases.

## Key Insight: Blueprint Composition

We're not building a reactive system - we're creating blueprints for Zustand
stores. The key insight is that:

1. Models are just functions that return slice creators
2. Slice creators are functions that, when called with Zustand's (set, get),
   return state+methods
3. Our job is to compose these blueprints correctly so when Zustand instantiates
   them, the references work

Zustand handles all the reactivity after the store is created. Our challenge is
to preserve property references during composition.

## Many Models, One Store

A critical aspect of this architecture is the many-to-one relationship between
models and the final Zustand store:

1. Users define and compose multiple independent models
2. Each model contributes a slice of the final store
3. All models ultimately get merged into a single Zustand store
4. The merged store provides a unified state object where all models can access
   each other's properties

This means that `get()` in any model accesses the same shared store. When model
B references `get().foo` where `foo` is defined in model A, both models are
operating on the same unified store instance, just contributing different parts
to it.

The composition system needs to ensure that these separate model definitions
correctly merge into a cohesive store with properly preserved property
references.

## Key Questions

### Enforcing Composition Constraints

- How do we detect and prevent multiple compositions of the same model?
- What's the right error message to display when these constraints are violated?

### Property Reference Preservation

- If model B extends model A, and uses `get().foo` where `foo` is from model A,
  this is primarily a typing concern - we need to ensure TypeScript understands
  that model B has access to model A's properties through `get()`.
- At runtime, Zustand will handle the actual property access when all models are
  merged into a single store.
- The composition system just needs to provide the correct typing so developers
  get proper autocomplete and type-checking.

### Type System Design

The type system should:

1. Preserve type information across model boundaries
2. Allow `get()` to access properties from all composed models
3. Infer the complete type without requiring explicit annotations
4. Generate appropriate errors for constraint violations at compile-time when
   possible

When model C composes model B which composed model A, model C's type system
should understand it has access to properties from all three models through the
unified Zustand store, while still enforcing our composition constraints.

### Types

- How can TypeScript help ensure correctness across composition boundaries?
- Can we infer the full composed model type without explicit annotations?
- How do we avoid excessive type complexity while ensuring type safety?

## Approach Ideas

### Slice Creation

Given our constraints, slice creation becomes simpler:

1. Take the base model's slice creator
2. Apply the extension layer directly (no need for complex chains)
3. Return a function that, when called by Zustand with (set, get), properly
   instantiates both

### Handling the get() Function

The `get()` function provided during composition is not Zustand's actual
`get()` - it's a placeholder that will eventually be replaced by Zustand's real
`get()` when the store is created. During composition, we need to:

1. Provide a `get()` placeholder that lets us collect property references
2. Structure our composition so these references work when Zustand's real
   `get()` is used
3. Ensure the order of slice creation preserves these references

### Handling of Methods vs Properties

Both methods and properties should be passed through as-is during composition.
The difference is:

- Properties will be read directly from the store when Zustand's `get()` is
  called
- Methods will be executed in the context of the store when called

## Test Cases to Consider

1. **Valid composition** - Model B composes Model A
2. **Invalid multiple composition** - Model B and Model C both try to compose
   Model A
3. **Invalid transitive composition** - Model C tries to compose Model B which
   composes Model A
4. **Cross-boundary references** - Model properties that reference properties
   from other models
5. **Error handling** - Clear error messages when composition constraints are
   violated

## Implementation Challenges

- **Constraint enforcement** - Ensuring each model is composed at most once
- **Error messages** - Providing clear, actionable error messages when
  constraints are violated
- **Type preservation** - Maintaining type safety across composition boundaries
- **Debugging experience** - Making the system transparent and debuggable

## Initial Mental Model

I'm starting to think of models as building blocks that can be assembled in a
strict, linear sequence. Each model can contribute to a Zustand store, but with
clear rules about how they can be combined.

The composition system doesn't create a complex graph of dependencies, but
rather a simple pipeline where each building block is used exactly once.

This approach may be more restrictive than other solutions, but it leads to a
more predictable and understandable system.
