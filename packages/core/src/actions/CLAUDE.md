# Actions - Pure Intent Functions

Actions are pure intent functions that represent WHAT should happen, delegating the HOW to model methods. They form the public API surface for triggering state changes while maintaining a clean separation of concerns.

## Key Concepts

- **Delegation Pattern**: Actions delegate to model methods without implementation logic
- **Intention vs. Implementation**: Actions define WHAT should happen, models define HOW
- **Pure Function Approach**: Actions should not contain business logic

## API Reference

### Creating Actions

```typescript
// Model is created and finalized first
const finalModel = prepare(model);

// Create actions that delegate to model methods
const actions = createActions(({ mutate }) => ({
  increment: mutate(finalModel, "increment"),
  reset: mutate(finalModel, "reset"),
  incrementTwice: mutate(finalModel, "incrementTwice")
}));
```

### Action Composition

Actions can be composed using the fluent composition pattern:

```typescript
// Enhance actions with additional delegates
const enhancedActions = compose(actions).with(({ mutate }) => ({
  incrementAndReset: mutate(finalModel, "incrementAndReset"),
  customAction: mutate(finalModel, "customMethod")
}));

// Finalize for use
const finalActions = prepare(enhancedActions);
```

## Implementation Details

- Actions are branded with `ACTIONS_INSTANCE_BRAND` for runtime identification
- The `mutate` function creates a reference to a model method
- Actions do not implement business logic, only delegate to model methods
- Actions are publicly exposed for triggering state changes

## Design Principles

1. **Separation of Concerns**: Actions (WHAT) are separate from models (HOW)
2. **Simplicity**: Actions should be simple delegates, not complex functions
3. **Discoverability**: Actions form the public API for state changes
4. **No Side Effects**: Actions should not perform side effects directly
5. **SAM Pattern**: Actions are part of the State-Action-Model pattern

## Testing Actions

Tests should verify that actions correctly delegate to model methods:

```typescript
// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should delegate to model methods', () => {
    // Mock model with method spy
    const mockModel = {
      increment: vi.fn()
    };
    
    // Create actions
    const actions = createActions(({ mutate }) => ({
      increment: mutate(mockModel, "increment")
    }));
    
    const finalActions = prepare(actions);
    const actionsInstance = finalActions()({ 
      mutate: <M, K extends keyof M>(model: M, key: K) => 
        ((...args: any[]) => (model[key] as any)(...args))
    });
    
    // Call action
    actionsInstance.increment();
    
    // Verify delegation
    expect(mockModel.increment).toHaveBeenCalled();
  });
}
```