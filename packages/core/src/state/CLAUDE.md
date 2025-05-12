# State - Public Selectors

State provides the public read access to a model, forming part of the public API surface. State selectors expose data and computed values derived from models while maintaining encapsulation of the internal model structure.

## Key Concepts

- **Public API Surface**: State forms the public read API for components
- **Derive Pattern**: State uses `derive()` to create reactive subscriptions to models
- **Computed Values**: State can include both direct selectors and computed values

## API Reference

### Creating State

```typescript
// Model is created and finalized first
const finalModel = prepare(model);

// Create state with derivations from the model
const state = createState(({ derive, get }) => ({
  // Direct model property derivation
  count: derive(finalModel, "count"),
  
  // Transformed derivation
  doubled: derive(finalModel, "count", (count) => count * 2),
  
  // Computed value using get()
  isPositive: () => get().count > 0
}));
```

### State Composition

State can be composed using the fluent composition pattern:

```typescript
// Enhance state with additional derived values
const enhancedState = compose(state).with(({ derive, get }) => ({
  // Additional derivations
  formatted: derive(finalModel, "count", (count) => `Count: ${count}`),
  
  // Computed values based on existing state
  description: () => `The count is ${get().isPositive() ? 'positive' : 'zero or negative'}`
}));

// Finalize for use
const finalState = prepare(enhancedState);
```

## Implementation Details

- State is branded with `STATE_INSTANCE_BRAND` for runtime identification
- The `derive` function creates reactive subscriptions to model properties
- State is the boundary between internal model details and public API
- State can transform model data into more consumable formats

## Design Principles

1. **Encapsulation**: State hides internal model details
2. **Reactivity**: State updates automatically when model changes
3. **Transformation**: State can reshape data for consumers
4. **Composability**: State can be composed and extended
5. **Public Interface**: State forms the public read API

## Testing State

Tests should verify that state correctly derives from models:

```typescript
// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should derive state from model', () => {
    // Create model (mock for testing)
    const mockModel = {
      count: 5
    };
    
    // Mock derive function
    const mockDerive = vi.fn((model, key, transform) => {
      const value = model[key];
      return transform ? transform(value) : value;
    });
    
    // Create state
    const state = createState(({ derive }) => ({
      count: derive(mockModel, "count"),
      doubled: derive(mockModel, "count", (count) => count * 2)
    }));
    
    const stateInstance = state()({ 
      get: vi.fn(),
      derive: mockDerive
    });
    
    // Verify derivations
    expect(stateInstance.count).toBe(5);
    expect(stateInstance.doubled).toBe(10);
    expect(mockDerive).toHaveBeenCalledTimes(2);
  });
}
```