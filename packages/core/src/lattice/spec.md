# Lattice Implementation Specification

This document outlines the implementation plan for the Lattice component in the framework. A lattice is both the declarative contract and the actual API for a component, bringing together models, actions, states, and views into a cohesive structure.

## Core Concepts

A lattice encapsulates:
- **Model**: Internal state and business logic (HOW)
- **Actions**: Pure intent functions for state changes (WHAT)
- **State**: Public selectors for read access
- **Views**: UI attributes mapped from state/actions

## Type System

### Core Lattice Type

```typescript
export interface LatticeLike<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly model: PreparedModelInstance<TModel>;
  readonly state: PreparedStateInstance<TState>;
  readonly actions: PreparedActionsInstance<TActions>;
  readonly view: {
    readonly [K in keyof TViews]: PreparedViewInstance<TViews[K]>;
  };
}
```

### Branded Lattice Type

```typescript
export const LATTICE_BRAND = Symbol('lattice');

export type Lattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> = Branded<
  LatticeLike<TModel, TState, TActions, TViews>,
  typeof LATTICE_BRAND
>;
```

## Implementation Tasks

### 1. Lattice Creation

```typescript
/**
 * Creates a new lattice with the given components
 * 
 * @param components The components object with model, state, actions and view
 * @returns A branded lattice object
 */
export function createLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  components: {
    model: PreparedModelInstance<TModel> | Lattice<any, any, any, any>;
    state: PreparedStateInstance<TState> | Lattice<any, any, any, any>;
    actions: PreparedActionsInstance<TActions> | Lattice<any, any, any, any>;
    view: {
      [K in keyof TViews]: PreparedViewInstance<TViews[K]> | Lattice<any, any, any, any>;
    } | Lattice<any, any, any, any>;
  }
): Lattice<TModel, TState, TActions, TViews>;
```

Implementation details:
- Detect when a lattice is passed for a component and extract the appropriate component from it
- Detect when a lattice is passed for view and extract view components
- Support spreading views with a utility function
- Validate all components are properly prepared
- Brand the resulting lattice with LATTICE_BRAND

### 2. View Composition Utilities

```typescript
/**
 * Access a specific view from a lattice
 * 
 * @param lattice The lattice to extract a view from
 * @param viewName The name of the view to extract
 * @returns The specified view
 */
export function use<
  TModel,
  TState,
  TActions,
  TViews extends Record<string, unknown>,
  K extends keyof TViews
>(
  lattice: Lattice<TModel, TState, TActions, TViews>,
  viewName: K
): PreparedViewInstance<TViews[K]>;

/**
 * Spread all views from a lattice
 * 
 * @param lattice The lattice to extract views from
 * @returns An object containing all views from the lattice
 */
export function spreadViews<
  TModel, 
  TState, 
  TActions, 
  TViews extends Record<string, unknown>
>(
  lattice: Lattice<TModel, TState, TActions, TViews>
): { 
  [K in keyof TViews]: PreparedViewInstance<TViews[K]> 
};
```

Implementation details:
- Extract the specified view from a lattice with appropriate type safety
- Create a utility to spread all views from a lattice
- Maintain proper typing of views

### 3. Runtime Tools

#### Derive Tool

```typescript
/**
 * Creates a reactive subscription to a source property
 * 
 * @param source The source object (model or state)
 * @param key The property key to derive from
 * @param transform Optional transformation function
 * @returns The derived value
 */
export function derive<M, K extends keyof M, R = M[K]>(
  source: M,
  key: K,
  transform?: (value: M[K]) => R
): R;
```

Implementation details:
- Use Zustand's `subscribe` to create reactive subscriptions
- Cache derived values for performance
- Track dependency graphs for efficient updates
- Validate usage context (only in state/view creation)
- Prevent usage in nested functions/methods

#### Dispatch Tool

```typescript
/**
 * Creates an event handler that dispatches to an action
 * 
 * @param actions The actions object
 * @param actionName The name of the action to dispatch to
 * @returns A function that dispatches to the action
 */
export function dispatch<A, K extends keyof A>(
  actions: A,
  actionName: K
): A[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;
```

Implementation details:
- Connect view event handlers to actions
- Validate usage context (only in view creation)
- Ensure actions object is properly prepared
- Prevent usage in nested functions/methods

#### Mutate Tool

```typescript
/**
 * Creates a reference to a model method
 * 
 * @param model The model object
 * @param methodName The name of the method to reference
 * @returns A function that delegates to the model method
 */
export function mutate<M, K extends keyof M>(
  model: M,
  methodName: K
): M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;
```

Implementation details:
- Connect actions to model methods
- Validate usage context (only in actions creation)
- Ensure model is properly prepared
- Prevent usage in nested functions/methods

### 4. Instantiation

```typescript
/**
 * Creates a fully instantiated lattice for use
 * 
 * @param lattice The lattice definition
 * @param options Optional configuration
 * @returns The instantiated lattice store
 */
export function instantiateLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  lattice: Lattice<TModel, TState, TActions, TViews>,
  options?: { 
    initialState?: Partial<TModel>;
  }
): {
  store: StoreApi<TModel>;
  getState: () => TState;
  getActions: () => TActions;
  getView: () => TViews;
};
```

Implementation details:
- Create Zustand store with model as initial state
- Wire up derive/dispatch/mutate relationships
- Return a core object with access to state, actions, and views
- Handle multiple instances with proper isolation

## Guard Rails Design

To enforce proper usage patterns, we'll implement several layers of protection:

### 1. TypeScript Guards

- Generic type constraints on all APIs
- Type-level validation of prepared components
- Branded types to prevent incorrect substitutions
- Function overloading for different component types

### 2. Runtime Validation

```typescript
function validatePreparedComponent(
  component: unknown,
  type: 'model' | 'state' | 'actions' | 'view',
  componentName?: string
): void {
  if (!isPrepared(component)) {
    throw new Error(
      `Expected a prepared ${type} component${componentName ? ` for "${componentName}"` : ''}, but received an unprepared component. Use prepare() before adding to a lattice.`
    );
  }
  
  // Component-specific validation
  switch (type) {
    case 'model':
      if (!isModelInstance(component)) {
        throw new Error(`Expected a model instance, but received a different component type.`);
      }
      break;
    // Similar checks for other component types
  }
}
```

### 3. Context Checking

```typescript
const DeriveContext = {
  inState: false,
  inView: false,
  
  checkState() {
    if (!this.inState && !this.inView) {
      throw new Error('derive() can only be used during state or view creation.');
    }
  },
  
  runInState<T>(fn: () => T): T {
    const prevState = this.inState;
    this.inState = true;
    try {
      return fn();
    } finally {
      this.inState = prevState;
    }
  }
};
```

### 4. Callsite Analysis

```typescript
function checkDirectPropertyAssignment(fnName: string): void {
  // Get call stack
  const stack = new Error().stack;
  
  // Look for patterns indicating nested function calls
  if (stack && /\.map\(|\.filter\(|\.reduce\(|=>.*=>/.test(stack)) {
    throw new Error(
      `${fnName}() must be called directly as a property value, not inside nested functions or methods.`
    );
  }
}
```

### 5. Component Resolution

```typescript
function resolveComponent(componentOrLattice: unknown, type: 'model' | 'state' | 'actions'): unknown {
  if (isLattice(componentOrLattice)) {
    // Extract the requested component from the lattice
    return (componentOrLattice as LatticeLike<any, any, any, any>)[type];
  }
  return componentOrLattice;
}

function resolveView(viewOrLattice: unknown, viewName?: string): unknown {
  if (isLattice(viewOrLattice)) {
    if (viewName) {
      // Extract the specific view
      return (viewOrLattice as LatticeLike<any, any, any, any>).view[viewName];
    } else {
      // Return all views
      return (viewOrLattice as LatticeLike<any, any, any, any>).view;
    }
  }
  return viewOrLattice;
}
```

## Examples of Enhanced API

The enhanced createLattice API supports more direct composition by allowing either prepared instances or entire lattices for each component:

```typescript
// Example 1: Creating a new lattice with specific components
const baseLattice = createLattice({
  model: prepare(counterModel),
  state: prepare(counterState),
  actions: prepare(counterActions),
  view: {
    counter: prepare(counterView),
    button: prepare(buttonView)
  }
});

// Example 2: Enhancing a lattice with composition
const enhancedLattice = createLattice({
  // New composed model
  model: prepare(composedModel),
  
  // Pass-through state from base lattice
  state: baseLattice,
  
  // Pass-through actions from base lattice
  actions: baseLattice,
  
  // Mix of new, extracted, and spread views
  view: {
    // New composed view
    enhancedCounter: prepare(enhancedCounterView),
    
    // Extract specific view from base lattice
    button: use(baseLattice, "button"),
    
    // Spread all views from base lattice
    ...spreadViews(baseLattice)
  }
});
```

## Implementation Sequence

1. Create core types (LatticeLike, Lattice, etc.)
2. Implement guard rail utilities
3. Implement runtime tools (derive, dispatch, mutate)
4. Create view utilities (use, spreadViews)
5. Implement createLattice function
6. Implement lattice instantiation
7. Add comprehensive tests for all components

## Future Enhancements

- **Async Support**: Better handling of async operations with loading/error states
- **DevTools Integration**: Time-travel debugging for lattice state
- **Middleware System**: Hooks for intercepting actions and state changes
- **Framework Adapters**: Dedicated adapters for React, Vue, Svelte, etc.
- **Performance Optimization**: Memoization and selective re-rendering

## Tasks Breakdown

1. Core type definitions and branding
2. Component resolution utilities
3. View utilities (use, spreadViews)
4. createLattice implementation
5. derive tool with guardrails
6. dispatch tool with guardrails
7. mutate tool with guardrails
8. Lattice instantiation
9. Guard rail implementation
10. Tests for all components
11. Documentation and examples