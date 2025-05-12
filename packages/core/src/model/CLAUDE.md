# Model - Primary Unit of Composition

The model is the fundamental building block in Lattice, encapsulating both state and business logic. It defines the contract for state mutations and forms the source of truth for the application state.

## Key Concepts

- **Factory Creation**: `createModel()` creates a Model factory
- **Composition**: `compose(model).with()` adds new properties/methods
- **Finalization**: `prepare(model)` finalizes for use

## API Reference

### Creating Models

```typescript
// Basic model creation
const counterModel = createModel(({ set, get }) => ({
  // State
  count: 0,
  
  // Mutations
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  
  // Selectors
  getCount: () => get().count
}));
```

### Model Composition

Models are composed using the fluent composition pattern:

```typescript
// Add behavior with .with()
const enhancedModel = compose(counterModel).with(({ get }) => ({
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
  doubleCount: () => get().count * 2
}));

// Finalize for use
const finalModel = prepare(enhancedModel);
```

## Implementation Details

- Models are branded with `MODEL_INSTANCE_BRAND` for runtime identification
- The factory pattern has two levels (factory returning a factory function)
- Models define the HOW (implementation) while actions define the WHAT (intent)
- All business logic and state mutations should be defined in models
- Model methods can access other model methods using `get()`
- Zustand's `set` and `get` functions are provided to model factories

## Design Principles

1. **Encapsulation**: Models contain all state and business logic
2. **Composability**: Model behaviors can be composed and extended
3. **Purity**: Prefer pure functions for all model methods
4. **Immutability**: Use immutable patterns with Zustand's `set`
5. **Separation of Concerns**: Models define HOW, not WHAT

## Testing Models

Tests should focus on state transitions and business logic:

```typescript
// In-source tests
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should increment counter', () => {
    const model = createModel(({ set, get }) => ({
      count: 0,
      increment: () => set(state => ({ count: state.count + 1 }))
    }));
    
    const mockGet = vi.fn(() => ({ count: 0 }));
    const mockSet = vi.fn();
    
    const slice = model()({ get: mockGet, set: mockSet });
    slice.increment();
    
    expect(mockSet).toHaveBeenCalledWith(expect.any(Function));
  });
}
```