# Actions

Actions are a core concept in the Lattice framework that represent pure intent functions, defining WHAT should happen while delegating to models (HOW). Actions are part of the fluent composition pattern in Lattice, supporting the `.with()` method for extension and the `.create()` method for finalization.

## Overview

Actions in Lattice:

- Represent the WHAT of user operations
- Delegate to model methods for implementation
- Support composition with other actions
- Use the `mutate` function to trigger model mutations

## API

### `createAction`

Creates an action factory with a fluent composition API.

```typescript
function createAction<T>(
  factory: (tools: ActionsFactory<T>) => T
): ActionInstance<T>
```

Example:

```typescript
// Basic usage
const counterActions = createAction(({ mutate }) => ({
  increment: mutate(counterModel, "increment"),
  decrement: mutate(counterModel, "decrement"),
  reset: mutate(counterModel, "reset")
}));

// With composition
const extendedActions = counterActions.with(({ mutate }) => ({
  incrementTwice: mutate(enhancedModel, "incrementTwice")
}));

// Finalize for use
const finalActions = extendedActions.create();
```

### The Action API

Actions support the following methods:

| Method | Description |
| ------ | ----------- |
| `with<U>()` | Extends the action with additional functionality |
| `create()` | Finalizes the action to be ready for use |

### Composition

Actions can be composed with other actions using the `.with()` method:

```typescript
const baseActions = createAction(({ mutate }) => ({
  increment: mutate(counterModel, "increment"),
}));

const extendedActions = baseActions.with(({ mutate }) => ({
  reset: mutate(counterModel, "reset"),
}));
```

## Implementation Details

Actions leverage the shared composition pattern used throughout Lattice, adapted for actions specifically:

- **No State Management**: Unlike models and state, actions don't use Zustand's state management
- **Mutate Function**: Actions primarily use the `mutate` function to trigger model mutations
- **Type Safety**: Maintains strong typing throughout the compositional API
- **Validation**: Checks for circular references and other potential runtime issues

> **Note on Implementation Status**: The current implementation focuses on the type-level API and composition functionality. As specified, the runtime implementation for the `mutate` function is a minimal stub for testing purposes. The full implementation of the `mutate` function will be completed after lattices are finished.

## Integration with Models

Actions delegate to models for implementation. The `mutate` function is the primary way actions interact with models:

```typescript
// Create a model
const counterModel = createModel(({ set }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
})).create();

// Create actions that use the model
const counterActions = createAction(({ mutate }) => ({
  increment: mutate(counterModel, "increment"),
  reset: mutate(counterModel, "reset"),
})).create();
```

The `mutate` function creates a function that, when called, will execute the specified method on the model.

## Best Practices

1. **Pure Intent**: Actions should represent pure intent (WHAT), not implementation (HOW)
2. **Composition**: Use composition to build complex actions from simpler ones
3. **Naming**: Use clear, action-oriented names for actions
4. **Delegation**: Always delegate implementation to models