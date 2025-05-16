# Delta Analysis - Lattice Framework Implementation

## Initial Observations

This analysis identifies the differences between the current codebase implementation and the updated specification in spec.md. The changes required are significant but focus on structural improvements and API clarity.

## Current Implementation Status

The current implementation includes:
- Core factory functions (`createModel`, `createState`, `createActions`, `createView`)
- Type branding system for runtime identification
- Basic composition with fluent API
- In-source testing

Key missing components:
- No implementation of `createLattice`/`createComponent`
- No top-level index.ts for exports
- No Zustand store integration
- No slices-based architecture

## Terminology Changes

The most significant terminology shift is from "State" to "Selectors":

**Current**:
- `createState` function
- STATE_FACTORY_BRAND and STATE_INSTANCE_BRAND symbols
- Type definitions referencing "State"

**Spec**:
- `createSelectors` function
- Consistent use of "Selectors" throughout documentation

This shift provides greater semantic clarity as "selectors" better describes the read-only access to model state.

## API Parameter Changes

### Model Composition

**Current**:
```typescript
// Create base model
const counterModel = createModel((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Composition
compose(baseModel).with<Ext>(
  ({ get, set }) => ({
    doubled: () => get().count * 2,
  })
);
```

**Spec**:
```typescript
// Create base model
const counterModel = createModel((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Composition
const enhancedModel = createModel(
  compose(counterModel).with((set, get, slice) => ({
    ...slice,
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }))
);
```

Key differences:
1. Addition of a `slice` parameter that provides access to the base component
2. Explicit spread (`...slice`) to include base properties
3. Creates a new factory with the composed result

### Actions Composition

**Current**:
```typescript
const actions = createActions(({ mutate }) => ({
  increment: mutate(counterModel).increment,
}));
```

**Spec**:
```typescript
const actions = createActions(model, (getModel) => ({
  increment: getModel().increment,
  incrementTwice: getModel().incrementTwice,
}));
```

Key differences:
1. The model is now passed as a first parameter
2. A `getModel` function is provided instead of `mutate`
3. Direct access to model methods through `getModel()` rather than `mutate(model).method`

### Selectors (formerly State) Composition

**Current**:
```typescript
const counterState = createState(({ get }) => ({
  count: 0,
  doubleCount: () => get().count * 2,
}));
```

**Spec**:
```typescript
const selectors = createSelectors(model, (getModel) => ({
  // Direct property access
  count: getModel().count,
  // Computed value
  isPositive: getModel().count > 0,
  // Function computing a value based on runtime input
  getFilteredItems: (filter) => getModel().items.filter(item => 
    item.name.includes(filter)
  ),
}));
```

Key differences:
1. `createState` is renamed to `createSelectors`
2. The model is passed as a first parameter
3. A `getModel` function is provided instead of `get`
4. Selectors directly access model properties

### View Creation and Composition

**Current**:
```typescript
const view = createView(({ get }) => ({
  "data-count": get().count
}));
```

**Spec**:
```typescript
const counterView = createView(selectors, actions, (getSelectors, getActions) => ({
  "data-count": getSelectors().count,
  "aria-live": "polite",
  onClick: getActions().increment,
}));
```

Key differences:
1. View receives both selectors and actions as parameters
2. Factory receives both `getSelectors` and `getActions` functions
3. View only accesses selectors and actions, not the model directly
4. Either parameter can be null if not needed

### Component Creation

**Current**:
No direct implementation found for `createLattice` in the current codebase.

**Spec**:
```typescript
return createComponent({
  model: enhancedModel,
  actions, 
  selectors,
  view: {
    counter: counterView,
    button: buttonView,
  },
});
```

Key differences:
1. New `createComponent` function (replaces conceptual `createLattice`)
2. Configuration passed as a single object parameter
3. Type checking ensures all parts reference the same model
4. View is explicitly namespaced into categories (counter, button, etc.)

## The `slice` Parameter and Cherry-Picking

A central change in the fluent composition API is the addition of the `slice` parameter:

**Current**:
```typescript
// For models
compose(baseModel).with<Ext>(
  ({ get, set }) => ({
    doubled: () => get().count * 2,
  })
);
```

**Spec**:
```typescript
compose(counterModel).with((set, get, slice) => ({
  ...slice, // Spread all properties from the base
  incrementTwice: () => {
    get().increment();
    get().increment();
  },
}));

// Selective cherry-picking
compose(selectorsA).with((getModel, slice) => ({
  count: slice.count,  // Only include properties that exist in both
  doubled: getModel().count * 2,
}));
```

Key differences:
1. Addition of the `slice` parameter with access to the base component's properties
2. Users must explicitly spread `...slice` to include all properties 
3. Cherry-picking specific properties is possible
4. More intuitive pattern for property selection

## Component Enhancement Pattern

The spec introduces a clear pattern for enhancing existing components:

```typescript
// Create a base component
const createCounterLattice = () => {
  // Create model, actions, selectors, views...
  return createComponent({ /* config */ });
};

// Enhance an existing component
const createEnhancedComponent = (baseComponent) => {
  // Enhance by composing with the base component
  const model = createModel(compose(baseComponent).with(/* ... */));
  
  // Use withComponent for component composition
  return createComponent({
    model,
    actions,
    selectors,
    view: {
      ...baseComponent.getViews(),  // Keep original views
      counter: view,                // Override with enhanced view
      resetButton,                  // Add new view
    },
  });
};
```

Key aspects:
1. Clear separation between creation and enhancement
2. Ability to reference the base component wholesale
3. Adding, keeping, or overriding views as needed

## Type Safety and Contract Enforcement

The spec places strong emphasis on type safety during composition:

```typescript
// This would cause a TypeScript error - title property doesn't exist on modelB
const selectorsB = createSelectors(
  modelB,
  compose(selectorsA).with((getModel, slice) => ({
    ...slice,  // Error: Property 'title' is accessed but doesn't exist on modelB
    doubled: getModel().count * 2,
  }))
);

// Correct approach - manually select compatible properties
const selectorsB = createSelectors(
  modelB,
  compose(selectorsA).with((getModel, slice) => ({
    count: slice.count,  // Only include properties that exist in both
    doubled: getModel().count * 2,
  }))
);
```

This focus includes:
1. Early detection of property access errors
2. Clear type errors when properties don't exist
3. Explicit property selection for handling type incompatibilities
4. Runtime validation matching TypeScript's static checks

## Zustand Store Implementation

The spec outlines a slices-based pattern for Zustand integration:

```typescript
// Internal representation - all parts become slices of a single store
export const createComponentStore = (config) => create((...a) => ({
  model: config.getModel(...a),      // Model slice with internal state and methods
  selectors: config.getSelectors(...a), // Selectors with computed values
  views: config.getViews(...a),      // View slices for UI attributes
  actions: config.getActions(...a),  // Actions slice for intent methods
}))
```

Key implementation details:
1. Property prefixing to prevent collisions
2. Adapter for Zustand's auto-generated selectors pattern
3. Subscription support for targeted updates
4. Separation of concerns while maintaining reactivity

## Breaking Changes Summary

Based on analysis, here are the major changes needed:

1. **Terminology Changes**:
   - `state` → `selectors` throughout the codebase
   - `createState` → `createSelectors`
   - STATE_* symbols → SELECTORS_* symbols
   - All related type definitions

2. **API Parameter Changes**:
   - Model composition adds `slice` parameter
   - Actions creation adds model as first parameter, changes `mutate` to `getModel()`
   - Selectors creation adds model as first parameter, changes `get` to `getModel()`
   - View creation adds selectors & actions as parameters, provides `getSelectors`, `getActions`

3. **Component Creation**:
   - Add new `createComponent` function
   - Create `withComponent` helper for component composition
   - Define component configuration structure

4. **Composition Pattern**:
   - Addition of `slice` parameter to all composition callbacks
   - Explicit property spreading with `...slice`
   - Cherry-picking via direct property access

5. **Store Implementation**:
   - Create entire slice-based store implementation
   - Implement property prefixing
   - Add subscription support
   - Create React hooks integration

## Technical Challenges

Some implementation aspects that may be particularly challenging:

1. **Type Inference**: Getting accurate type inference for nested compositions with slice parameters
2. **Runtime Type Checking**: Ensuring runtime checks match TypeScript's static analysis
3. **Selective Property Access**: Implementing cherry-picking with proper type checking
4. **Store Integration**: Creating efficient reactive bindings with proper property isolation

## Final Assessment

The changes outlined in the updated spec represent a significant evolution of the Lattice framework, with improvements to:

1. **API Clarity**: More intuitive terminology and parameter structure
2. **Composition Pattern**: The addition of the `slice` parameter and explicit property handling
3. **Type Safety**: Strengthened contract enforcement and type checking
4. **Mental Model**: Clearer separation between model, selectors, actions, and views
5. **Store Integration**: More efficient reactive updates with better encapsulation

The most impactful changes are the introduction of the slice parameter, the shift from State to Selectors, and the explicit component creation and composition pattern. While implementation will require significant effort, these changes address fundamental design issues and will result in a more robust, easier-to-use API.