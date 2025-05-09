# Thinking Through View Composition

## The Problem Space

Following the successful implementation of state composition, we now need to
create a view composition system where:

1. Views are defined once but instantiated many times
2. Views can compose other views with the `.with()` method
3. Views can derive properties from finalized states (after `create()` is
   called)
4. Views can dispatch actions through proper channels
5. Property references are preserved through composition layers
6. Views provide a public, UI-ready API surface for rendering components
7. All of this happens before any actual UI rendering

Like models and states, view composition follows the blueprint approach - we're
not creating UI components directly, but blueprints for transforming state and
actions into ready-to-spread UI props.

## Key Insight: Views as UI Prop Projections

Views are essentially projections of states and actions that:

1. Transform state values into UI props
2. Connect UI events to actions
3. Provide ready-to-spread props for UI components
4. Map internal state to consumable UI properties

While states contain read-only data, views expose UI-ready props needed by
components. Views function as the bridge between state/actions and the actual UI
components.

## View Composition vs State Composition

View composition differs from state composition in several key ways:

1. **UI Props vs Data** - States expose data, views expose UI props
2. **Event Handlers vs Read-Only** - Views include event handlers, states are
   read-only
3. **Component-Facing vs Logic-Facing** - Views are component-facing, states are
   logic-facing
4. **Action Dispatching** - Views can dispatch actions, states cannot
5. **Composition** - Views compose with other views, creating merged UI prop
   sets

However, view composition shares the same fundamental API pattern as state and
model composition:

1. `createView()` creates a composable view blueprint
2. `.with()` allows fluent composition of views
3. `.create()` finalizes views for use with UI components

## View References and Derivation

A critical aspect of view composition is the ability to reference state and
derive UI props:

### Derived Values from States

Views can create derived UI props from finalized state properties:

```typescript
const finalizedState = baseState.create();

const baseView = createView(({ derive }) => ({
   "data-count": derive(finalizedState, "count"),
   "aria-busy": false,
}));
```

### Action Dispatching

Views can connect UI events to actions:

```typescript
const baseView = createView(({ dispatch }) => ({
   onClick: dispatch(actions, "increment"),
   onKeyDown: (e) => {
      if (e.key === "Enter") dispatch(actions, "increment")();
   },
}));
```

### Composition of Views

When composing views, we combine their UI props:

```typescript
// First view derives from state
const counterView = createView(({ derive }) => ({
   "data-count": derive(finalizedState, "count"),
   "aria-live": "polite",
}));

// Second view composes with first view
const enhancedCounterView = counterView.with(({ derive, dispatch }) => ({
   // New props
   className: derive(
      finalizedState,
      "count",
      (count) => count > 0 ? "counter positive" : "counter zero",
   ),

   // Event handlers
   onClick: dispatch(actions, "increment"),
}));
```

## Type System for Views

The type system for views should:

1. Infer types from referenced finalized states
2. Track UI prop types (strings, numbers, event handlers)
3. Preserve type information through composition
4. Ensure type safety when accessing properties

Similar to states, the composition of views should maintain type information
throughout the chain.

## The Fluent Composition Pattern for Views

For views, the fluent composition pattern looks like:

```typescript
// Finalized state
const finalizedState = baseState.create();

// Base view
const baseView = createView(({ derive, dispatch }) => ({
   "data-count": derive(finalizedState, "count"),
   "aria-live": "polite",
   onClick: dispatch(actions, "increment"),
}));

// Extended view using .with()
const enhancedView = baseView.with(({ derive, dispatch }) => ({
   // Add or override UI props
   className: derive(
      finalizedState,
      "count",
      (count) => count > 0 ? "counter positive" : "counter zero",
   ),

   // Add new event handlers
   onKeyDown: (e) => {
      if (e.key === "Enter") dispatch(actions, "increment")();
   },
}));

// Finalize for use
const finalView = enhancedView.create();
```

This pattern provides a clear, readable way to build up view functionality while
maintaining type safety.

## View Finalization

Similar to states, views need a finalization step with `.create()` that:

1. Validates the view composition
2. Prevents further composition
3. Creates a distinct finalized view type
4. Prepares the view for use with UI components

The finalization step marks the boundary between composition and usage, ensuring
that only complete views are used in the application.

## Implementation Considerations

### View Factory Function

The `createView` function should:

1. Accept a factory function that receives tools for view creation
2. Return a composable view with `.with()` method
3. Provide tools like `derive` and `dispatch` for accessing state and actions

```typescript
function createView<T>(
   factory: (tools: ViewFactory<T>) => T,
): ViewInstance<T> {
   // Implementation details...
}
```

### View Composition Context

During composition, views need access to:

1. A `derive` helper to create derived props from finalized states
2. A `dispatch` helper to connect events to actions

```typescript
interface ViewFactory<T> {
   derive: <S extends FinalizedState<any>, K extends keyof S, R>(
      state: S,
      key: K,
      transform?: (value: S[K]) => R,
   ) => R;
   dispatch: <A extends Actions<any>, K extends keyof A>(
      actions: A,
      key: K,
   ) => (...args: Parameters<A[K]>) => void;
}
```

### Derivation Constraints

The view system has important constraints on derivation:

1. **State-only derivation**: `derive` can only access finalized states (after
   `create()` is called)
2. **Action-only dispatching**: `dispatch` can only reference finalized actions
3. **Composition for view reuse**: Other views can only be accessed by composing
   them using `.with()`

### Common View Patterns

The view system should support these patterns:

1. **Prop derivation**: Mapping state values to UI props
2. **Event handling**: Connecting UI events to actions
3. **Conditional props**: Props that depend on state conditions
4. **Accessibility props**: ARIA props for accessibility
5. **Merged views**: Combining multiple views for a complete UI surface

## Benefits of the View Composition Approach

1. **Component Integration** - Views provide ready-to-spread props for UI
   components
2. **Separation of Concerns** - UI props are separated from state logic
3. **Accessibility** - ARIA props can be properly managed and derived
4. **Event Handling** - Clean pattern for connecting events to actions
5. **Composability** - Views can be composed and reused across components

## Relationship with Other System Components

Views form the final link in the overall architecture:

```
Models (internal) → States (public data) → Views (UI mapping)
                  → Actions (behavior) ────┘
```

While models contain all behavior and internal state, and states expose the
public read interface, views transform this data into consumable UI props that
components can directly spread into their JSX.

## Conclusion

The view composition system allows for fluent, type-safe composition of UI prop
projections from finalized states and actions. By following the same pattern as
model and state composition, it maintains consistency in the API while
addressing the specific needs of UI integration.

Like models and states, views are blueprints that are composed before UI
rendering, enabling a flexible, reusable approach to UI prop management.
