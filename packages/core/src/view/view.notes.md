# Thinking Through State Composition

## The Problem Space

Following the successful implementation of model composition, we now need to
create a state composition system where:

1. States are defined once but instantiated many times
2. States can compose other states with the `.with()` method
3. States can reference properties from finalized models (after `create()` is
   called)
4. Property references are preserved through composition layers
5. States provide a public, read-only API surface for models
6. All of this happens before any actual Zustand store is created

Like models, state composition follows the blueprint approach - we're not
creating reactive systems directly, but blueprints for extracting and deriving
state from Zustand stores.

## Key Insight: States as Model Projections

States are essentially projections or views of models that:

1. Extract specific properties from finalized models
2. Create derived values from model properties
3. Expose a read-only public API for model data
4. Transform internal model state into consumable public values

While models contain both state and behavior, states expose only the read-only
aspects needed by consumers. States function as the authorized public interface
to the underlying model.

## State Composition vs Model Composition

State composition differs from model composition in several key ways:

1. **Projection vs Extension** - Models extend behavior, states project
   selective views
2. **Read-only vs Mutable** - States expose read-only data, models contain
   mutable state
3. **Public vs Internal** - States are public-facing, models are
   composition-only
4. **Derivation Source** - States can only derive from finalized models, not
   other states
5. **Composition** - States compose with other states but don't derive from them

However, state composition shares the same fundamental API pattern as model
composition:

1. `createState()` creates a composable state blueprint
2. `.with()` allows fluent composition of states
3. `.create()` finalizes states for use with Zustand

## State References and Derivation

A critical aspect of state composition is the ability to reference and derive
values:

### Direct References from Models

States can directly reference finalized model properties:

```typescript
const finalizedModel = baseModel.create();

const baseState = createState(({ get }) => ({
   count: () => get().count, // Direct reference to model.count
}));
```

### Derived Values from Models

States can create derived values from finalized model properties:

```typescript
const finalizedModel = baseModel.create();

const baseState = createState(({ get, derive }) => ({
   doubleCount: derive(finalizedModel, "count", (count) => count * 2),
}));
```

### Composition of States

When composing states, we combine their APIs but don't directly derive from
them:

```typescript
// First state derives from model
const countState = createState(({ get, derive }) => ({
   count: derive(finalizedModel, "count"),
   isPositive: () => get().count > 0,
}));

// Second state composes with first state but derives only from model
const statsState = countState.with(({ get, derive }) => ({
   // Derives from model, not from countState
   doubleCount: derive(finalizedModel, "count", (count) => count * 2),

   // Can access composed state properties via get()
   description: () =>
      `Count is ${get().count} (${
         get().isPositive() ? "positive" : "zero or negative"
      })`,
}));
```

## Type System for States

The type system for states should:

1. Infer types from referenced finalized models
2. Track derived value types
3. Preserve type information through composition
4. Ensure type safety when accessing properties

Similar to models, the composition of states should maintain type information
throughout the chain.

## The Fluent Composition Pattern for States

For states, the fluent composition pattern looks like:

```typescript
// Finalized model
const finalizedModel = baseModel.create();

// Base state
const baseState = createState(({ get, derive }) => ({
   count: derive(finalizedModel, "count"),
   isPositive: () => get().count > 0,
}));

// Extended state using .with()
const enhancedState = baseState.with(({ get, derive }) => ({
   // Derives from model, not from baseState
   doubleCount: derive(finalizedModel, "count", (count) => count * 2),

   // Can access composed state via get()
   status: () => get().isPositive() ? "active" : "inactive",
}));

// Finalize for use
const finalState = enhancedState.create();
```

This pattern provides a clear, readable way to build up state functionality
while maintaining type safety.

## State Finalization

Similar to models, states need a finalization step with `.create()` that:

1. Validates the state composition
2. Prevents further composition
3. Creates a distinct finalized state type
4. Prepares the state for use with Zustand

The finalization step marks the boundary between composition and usage, ensuring
that only complete states are used in the application.

## Implementation Considerations

### State Factory Function

The `createState` function should:

1. Accept a factory function that receives tools for state creation
2. Return a composable state with `.with()` method
3. Provide tools like `get` and `derive` for accessing model data

```typescript
function createState<T>(
   factory: (tools: StateFactory<T>) => T,
): StateInstance<T> {
   // Implementation details...
}
```

### State Composition Context

During composition, states need access to:

1. The `get` function to reference properties
2. A `derive` helper to create derived values from finalized models

```typescript
interface StateFactory<T> {
   get: GetState<any>;
   derive: <M extends FinalizedModel<any>, K extends keyof ModelState<M>, R>(
      model: M,
      key: K,
      transform?: (value: ModelState<M>[K]) => R,
   ) => R;
}
```

### Derivation Constraints

The state system has important constraints on derivation:

1. **Model-only derivation**: `derive` can only access finalized models (after
   `create()` is called)
2. **No cross-state derivation**: States cannot derive from other states
   directly
3. **Composition for state reuse**: Other states can only be accessed by
   composing them using `.with()`
4. **Access through get()**: Composed state properties are accessed via the
   `get()` function

### Common Derivation Patterns

The state system should support these derivation patterns:

1. **Simple property projections**: Direct access to model properties
2. **Transformations**: Converting model values to different formats
3. **Combinations**: Deriving values from multiple model properties
4. **Conditional derivations**: Values that depend on conditions
5. **Access to composed state**: Referencing previously composed state through
   `get()`

## Benefits of the State Composition Approach

1. **Clear Public API** - States explicitly define the public interface to
   models
2. **Separation of Concerns** - Read-only state is separated from mutable model
   logic
3. **Encapsulation** - Internal model implementation details remain hidden
4. **Derivation** - Complex derived values can be computed from models
5. **Composability** - States can be composed and reused across components

## Relationship with Other System Components

States form a critical link in the overall architecture:

```
Models (internal) → States (public) → Views (UI mapping)
```

While models contain all behavior and internal state, states expose the public
read interface that views and components use to render UI.

## Conclusion

The state composition system allows for fluent, type-safe composition of state
projections from finalized models. By following the same pattern as model
composition but with model-only derivation constraints, it maintains consistency
in the API while addressing the specific needs of public state exposure.

Like models, states are blueprints that are composed before Zustand
instantiation, enabling a flexible, reusable approach to state management.
