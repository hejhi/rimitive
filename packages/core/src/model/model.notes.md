# Thinking Through Model Composition

## The Problem Space

I'm trying to create a model composition system where:

1. Models are defined once but instantiated many times
2. Models can compose other models with createModel.with()
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
2. **Cross-boundary references** - Model properties that reference properties
   from other models

## Implementation Challenges

- **Type preservation** - Maintaining type safety across composition boundaries
- **Debugging experience** - Making the system transparent and debuggable

## Initial Mental Model

I'm starting to think of models as building blocks that can be composed together
declaratively. Each model can be composed into a single Zustand store.

## Model Finalization: The Missing Piece

While thinking through model composition, I realized there's an important step
missing between model composition and using models with states, views, and
actions.

The key insight: States, views, and actions all need to operate on a fully
resolved, complete model. They depend on the runtime Zustand store that will be
created from a model, not on the intermediate composition steps.

### The Problem

- During composition, we're creating "blueprints" for models
- States, views, and actions need a finalized model blueprint to derive from
- We need a clear boundary between the composition phase and the derivation
  phase

### Proposed Solution: Finalization Step

Introduce a finalization model method, called `model.create()`, that:

1. Is a method on any model created with `createModel`
2. Performs any final validations or optimizations
3. Returns a "finalized" model that can be used with `createLattice` and for
   deriving states/views/actions

This creates a clear sequence:

```
Model Composition → Model Finalization → Derivation/Store Creation
```

### Extending to States and Views

Since states and views are similar in nature to models (they're also blueprint
creators), we likely need the same finalization concept for them. We could have:

- `createLatticeModel(model)`
- `createLatticeState(state)`
- `createLatticeView(view)`

Or potentially a generic function like `finalize(blueprint, type)` that handles
all types.

### Benefits of Finalization

1. **Type Safety**: The type system can enforce that only finalized models are
   used where complete models are expected
2. **Clear Boundaries**: Developers have a clear signal for when composition is
   complete
3. **Validation**: The finalization step could include validation to catch
   composition errors early
4. **Future Extensibility**: Could add optimizations or additional features
   during finalization

### Mental Model

In our mental model, we now have clear phases:

1. **Composition Phase**: Models, states, and views are composed using
   `createModel`, `extendModel`, etc.
2. **Finalization Phase**: Blueprints are finalized, creating a boundary between
   composition and use
3. **Derivation Phase**: States, views, and actions derive from finalized
   blueprints
4. **Instantiation Phase**: `createLattice` creates the actual Zustand store

This approach respects the blueprint nature of our system while acknowledging
that there's a point where blueprint definition needs to be complete before
derivation can occur.

## Exploring the .with() Pattern

As I think about model composition, the `.with()` pattern seems to offer several
compelling advantages:

1. It provides an **intuitive API** that clearly communicates model enhancement
   with additional properties and behaviors

2. It enables **progressive composition** where each step builds on the previous
   one in a clear, readable chain

3. It makes **explicit dependencies** visible, as each extension directly
   references its base model

4. It **reduces boilerplate** by eliminating the need to repeat `createModel` or
   use separate composition functions

5. It creates a **natural reading order** where code reads from left to right as
   "base model with feature A with feature B"

6. It establishes **clear composition boundaries** with explicit relationships
   between models at each step

7. It maintains **predictable types** by preserving and extending type
   information through each composition step

This approach fits well with the blueprint composition concept I've been
exploring. Rather than a two-phase approach, it provides a clean, chainable way
to build up model functionality.

### Implementation Considerations for .with()

To implement this pattern effectively, I would need to:

1. Make `createModel()` return an object with a `.with()` method
2. Ensure each `.with()` call returns another object with the same interface
3. Add a `.create()` method that finalizes the model

This would create a clear workflow:

```
createModel() → .with() → .with() → ... → .create()
```

The `.with()` approach ensures that the `get()` function always has the correct
context for accessing properties across model boundaries, while providing a
developer-friendly API that makes composition intent explicit.

## Implications for Model Finalization

With this fluent composition pattern, the `.create()` method becomes even more
essential as the boundary between composition and usage. It would:

1. Signal that a model's composition chain is complete
2. Return a finalized model that can't be further composed
3. Serve as the entry point for deriving states, views, and actions

This creates a many-to-one relationship where multiple composed models
ultimately contribute to a single unified Zustand store, with each model adding
its slice to the final state.

### Benefits of the Finalization Step

1. **Type Safety**: The type system can enforce that only finalized models are
   used where complete models are expected
2. **Clear Boundaries**: Developers have a clear signal for when composition is
   complete
3. **Validation Opportunity**: The finalization step could include validation to
   catch composition errors early
4. **Future Extensibility**: Could add optimizations or additional features
   during finalization

This finalization concept completes the mental model by establishing distinct
phases of model lifecycle: composition, finalization, derivation, and
instantiation.
