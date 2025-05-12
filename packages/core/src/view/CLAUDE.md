# View - Reactive UI Attributes

Views are pure, reactive representations that transform state and actions into ready-to-spread UI attributes. They provide the final layer in the Lattice architecture, creating a clean separation between framework-agnostic state/behavior and framework-specific rendering.

## Key Concepts

- **UI Attributes**: Views transform state into attribute objects for UI components
- **Framework Agnostic**: Views work with any UI framework (React, Vue, etc.)
- **Derivation Pattern**: Views derive their values from state and actions
- **Attribute Spreading**: View objects can be spread directly onto UI elements

## API Reference

### Creating Views

```typescript
// State and actions must be finalized first
const finalState = prepare(state);
const finalActions = prepare(actions);

// Create view with derivations from state and action dispatches
const view = createView(({ derive, dispatch }) => ({
  // Derived UI attributes from state
  "data-count": derive(finalState, "count"),
  "aria-label": derive(finalState, "formatted"),
  
  // Event handlers from actions
  onClick: dispatch(finalActions, "increment")
}));
```

### View Composition

Views can be composed using the fluent composition pattern:

```typescript
// Enhance view with additional UI attributes
const enhancedView = compose(view).with(({ derive, dispatch }) => ({
  // Additional attributes
  "data-doubled": derive(finalState, "doubled"),
  "aria-live": "polite",
  
  // Additional event handlers
  onDoubleClick: dispatch(finalActions, "incrementTwice")
}));

// Finalize for use
const finalView = prepare(enhancedView);
```

## Implementation Details

- Views are branded with `VIEW_INSTANCE_BRAND` for runtime identification
- The `derive` function creates reactive subscriptions to state properties
- The `dispatch` function creates event handlers from actions
- Views are typically namespaced within lattices
- Views produce plain objects that can be spread to UI elements

## Design Principles

1. **Separation of Concerns**: Views handle only UI attributes, not business logic
2. **Declarative**: Views describe what attributes should be, not how to compute them
3. **Composability**: Views can be composed and extended
4. **Reactivity**: Views update automatically when state changes
5. **Framework Agnosticism**: Views work with any UI framework

## Testing Views

Tests should verify that views correctly derive from state and actions:

```typescript
// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should create view attributes from state and actions', () => {
    // Mock state
    const mockState = {
      count: 5,
      formatted: "Count: 5"
    };
    
    // Mock action
    const mockIncrement = vi.fn();
    const mockActions = {
      increment: mockIncrement
    };
    
    // Mock derive/dispatch functions
    const mockDerive = vi.fn((state, key) => state[key]);
    const mockDispatch = vi.fn((actions, key) => actions[key]);
    
    // Create view
    const view = createView(({ derive, dispatch }) => ({
      "data-count": derive(mockState, "count"),
      "aria-label": derive(mockState, "formatted"),
      onClick: dispatch(mockActions, "increment")
    }));
    
    const viewInstance = view()({ 
      derive: mockDerive,
      dispatch: mockDispatch
    });
    
    // Verify attributes
    expect(viewInstance["data-count"]).toBe(5);
    expect(viewInstance["aria-label"]).toBe("Count: 5");
    expect(typeof viewInstance.onClick).toBe("function");
    
    // Verify deriving and dispatching
    expect(mockDerive).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
}
```