# Delta Analysis - Lattice Framework Implementation

## Initial Observations
Starting my analysis of the spec.md document versus the current codebase implementation. I'll document differences and required changes as I discover them.

## Terminology Changes

The most significant change evident in the spec.md is the terminology shift from "State" to "Selectors". The current implementation uses:
- `createState` in the codebase
- STATE_FACTORY_BRAND and STATE_INSTANCE_BRAND for type branding
- Various type definitions referencing "State"

However, the spec now refers to:
- `createSelectors` as the function name
- "Selectors" consistently throughout the documentation

This represents a fundamental terminology change that will require updates throughout the codebase. This shift appears to be for greater semantic clarity - "selectors" better describes the read-only access to model state.

## API Parameter Changes

### Model Composition
The current implementation of `createModel` appears to use a factory pattern with `(set, get)` parameters:
```typescript
const counterModel = createModel((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

The new spec shows a modified approach with:
```typescript
const enhancedModel = createModel(
  compose(counterModel).with((set, get, slice) => ({
    ...slice,
    incrementTwice: () => {
      get().increment();
      get().increment();
    },
  }))
)
```

The key difference is the addition of a `slice` parameter that provides access to the base component being extended.

### Actions Composition
The current implementation:
```typescript
const actions = createActions(({ mutate }) => ({
  // References model methods
}));
```

The new spec shows:
```typescript
const actions = createActions(model, (getModel) => ({
  increment: getModel().increment,
  incrementTwice: getModel().incrementTwice,
}));
```

Key differences:
1. The model is now passed as a first parameter
2. A `getModel` function is provided instead of `mutate`
3. The approach directly accesses model methods through `getModel()` rather than using `mutate(model).method`

### Selectors (formerly State) Composition
Current implementation:
```typescript
const counterState = createState(({ get }) => ({
  count: 0,
  doubleCount: () => get().count * 2,
}));
```

New spec:
```typescript
const selectors = createSelectors(model, (getModel) => ({
  count: getModel().count,
  isPositive: getModel().count > 0,
  getFilteredItems: (filter) => getModel().items.filter(item => 
    item.name.includes(filter)
  ),
}));
```

Key differences:
1. `createState` is renamed to `createSelectors`
2. The model is passed as a first parameter
3. A `getModel` function is provided instead of `get`
4. Selectors directly access model properties, creating a clear separation

### View Creation and Composition
Current implementation:
```typescript
const view = createView(factorySpy);
// ...
const slice = sliceCreator({ get: mockGet });
```

New spec:
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
5. Direct, explicit access to selectors and actions for better encapsulation

### Component Creation and Composition
Current implementation uses `createLattice`:
```typescript
// Based on type definition
export declare function createLattice<T>(name: string, config?: LatticeConfig<T>): Lattice<T>;
```

New spec uses `createComponent`:
```typescript
// Return the lattice component
return createComponent({
  // if the user had provided a selectors/view/action that referenced a different model,
  // there would be a type error
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
1. `createLattice` is renamed to `createComponent` for conceptual clarity
2. Configuration is passed as a single object parameter
3. Type checking ensures all parts (selectors, actions, views) reference the same model
4. View is explicitly namespaced into categories (counter, button, etc.)
5. Component composition preserves namespaces through the object structure

## The `slice` Parameter and Cherry-Picking

A significant change in the fluent composition API is the addition of the `slice` parameter to the composition callback:

Current implementation:
```typescript
// For models
compose(baseModel).with<Ext>(
  ({ get, set }) => ({
    doubled: () => get().count * 2,
  })
);

// For views, actions, state
// Similar patterns without a slice parameter
```

New spec:
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
1. Addition of the `slice` parameter that provides direct access to the base component's properties
2. Users must explicitly spread `...slice` to include all properties or cherry-pick specific ones
3. This enables more fine-grained control over which properties to include from the base component
4. Helps address type incompatibilities by allowing selective inclusion of compatible properties
5. More intuitive pattern for property selection without requiring complex utilities

This is a crucial change for enhancing the developer experience with clear, explicit property inclusion and type safety during composition.

## Component Enhancement vs. Creation Pattern

Another key distinction is how enhanced components are created:

Current implementation appears to use a similar pattern for both creation and enhancement.

New spec separates these concerns:
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
  
  // Component composition with withLattice
  return createComponent(
    withLattice(baseComponent)({
      model,
      actions,
      selectors,
      // ...
    }),
  );
};
```

Key differences:
1. Introduction of `withLattice` helper to compose whole components
2. Pattern clearly separates creation (from scratch) vs. enhancement (from base)
3. Ability to reference the base component wholesale, not just individual parts
4. Maintains all API contracts and type safety during whole-component composition

## Type Safety and Contract Enforcement

The spec places strong emphasis on type safety and contract enforcement during composition:

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

This focus on type safety involves:

1. Early detection of property access errors during composition
2. Clear type errors when properties don't exist on the model
3. Explicit property selection to handle type incompatibilities
4. Runtime validation matching TypeScript's static checks

The implementation needs to ensure this level of type checking throughout the composition system.

## Implementation Strategy for Composition

The spec provides details on the implementation approach:

```typescript
// Implementation of compose() with strong typing
function compose<BaseType>(base: BaseType) {
  return {
    // User only needs to specify return type, model type is inferred
    with<ReturnType, ModelType = InferModelType<BaseType>>(
      cb: (getModel: () => ModelType, slice: BaseType) => ReturnType
    ): ReturnType {
      // Implementation details...
    }
  };
}

// Type inference for models used in selectors
type InferModelType<T> = T extends { __MODEL_TYPE__: infer M } ? M : never;
```

This represents a significant change from the current implementation, which uses a different parameter approach. The new implementation should:

1. Infer model types automatically from selectors
2. Provide correct typing for the `slice` parameter
3. Allow extension return types to be specified or inferred
4. Properly type all composition scenarios

## Zustand Integration and Slices Pattern

The spec outlines a specific implementation approach using a slices pattern with Zustand:

```typescript
// Internal representation - all parts become slices of a single store
export const createComponentStore = (config) => create((...a) => ({
  model: config.getModel(...a),      // Model slice with internal state and methods
  selectors: config.getSelectors(...a), // Selectors with computed values
  views: config.getViews(...a),      // View slices for UI attributes
  actions: config.getActions(...a),  // Actions slice for intent methods
}))
```

Key implementation details include:

1. **Property Prefixing**: Each slice's properties are prefixed to prevent collisions
2. **Selector Generation**: Adapting Zustand's auto-generated selectors pattern
3. **Subscription Support**: Enabling targeted subscriptions to specific slices

This approach represents a significant refinement of the architecture, with each part of the component having a dedicated slice within a single store, while maintaining proper encapsulation and access control between different parts.

## Breaking Changes Summary

Based on the analysis so far, here are the major breaking changes that will need to be implemented:

1. **Terminology Changes**:
   - `state` -> `selectors` throughout the codebase
   - `createState` -> `createSelectors`
   - STATE_* symbols -> SELECTORS_* symbols
   - All related type definitions

2. **API Parameter Changes**:
   - Model creation unchanged but composition adds `slice` parameter
   - Actions creation adds model as first parameter, changes `mutate` to `getModel()`
   - State/Selectors creation adds model as first parameter, changes `get` to `getModel()`
   - View creation adds selectors & actions as parameters, provides `getSelectors`, `getActions`

3. **Component Creation**:
   - `createLattice` -> `createComponent`
   - New `withLattice` helper for component composition
   - Configuration object structure changes

4. **Composition Pattern**:
   - Addition of `slice` parameter to all composition callbacks
   - Property spreading must be explicit with `...slice`
   - Cherry-picking via direct property access from slice

## Implementation Plan

Given the extensive changes required, here's a proposed implementation plan:

1. **Core Type System Overhaul**:
   - Rename STATE_* constants to SELECTORS_*
   - Update type definitions in `shared/types.ts`
   - Create new type helpers for model inference

2. **Factory Function Updates**:
   - Update `createModel` to support slice parameter in composition
   - Replace `createState` with `createSelectors` function
   - Update `createActions` to accept model parameter and use getModel
   - Update `createView` to accept selectors/actions parameters

3. **Composition Pattern Enhancements**:
   - Update `compose/fluent.ts` to add slice parameter
   - Modify `compose/core.ts` implementation to properly pass slices
   - Add type-checking logic for incompatible components

4. **Component Creation**:
   - Create new `createComponent` function
   - Create `withLattice` helper for component composition
   - Port existing `createLattice` functionality to new approach

5. **Zustand Integration**:
   - Update slice-based store creation
   - Implement property prefixing to prevent collisions
   - Add subscription support for targeted observability

6. **Tests and Validation**:
   - Update in-source tests for all components
   - Add comprehensive tests for composition edge cases
   - Validate type safety across the system

## Migration Strategy

Given the significant API changes, a migration strategy will be essential:

1. **Version Management**:
   - Consider releasing a major version bump (1.0.0 → 2.0.0)
   - Ensure breaking changes are clearly documented

2. **Parallel Support**:
   - Potentially support both APIs in a transition period
   - Add deprecation warnings for old APIs

3. **Migration Guide**:
   - Create step-by-step migration examples for users
   - Provide codemods if possible to automate some migrations

4. **Update Documentation**:
   - Ensure README.md and other docs reflect new patterns
   - Add code examples with the updated API

## Potential Challenges

Some aspects of the implementation may be particularly challenging:

1. **Type Inference Edge Cases**: Getting proper TypeScript inference for nested compositions
2. **Backward Compatibility**: Some patterns may be difficult to maintain during transition
3. **Runtime Type Checking**: Ensuring runtime checks match TypeScript's static analysis
4. **Performance Optimization**: Maintaining Zustand's performance advantages with the new structure

## Final Assessment

The changes outlined in the updated spec represent a significant but worthwhile evolution of the Lattice framework. The key improvements include:

1. **More Intuitive Terminology**: Changing from "State" to "Selectors" better reflects the actual purpose of these components as read-only derivations from the model.

2. **Better Composition Pattern**: The addition of the `slice` parameter and explicit property handling makes composition more intuitive and less error-prone.

3. **Clearer Separation of Concerns**: The updated architecture creates a more explicit boundary between the internal model and the public API surface.

4. **Enhanced Type Safety**: The focus on contract enforcement and type checking provides better developer experience and catches errors earlier.

5. **Improved Mental Model**: The revised component structure with namespaced views and selectors creates a more coherent mental model for component composition.

While these changes will require significant refactoring, they address fundamental design issues and will result in a more robust, easier-to-use API that better fulfills the promise of "composable, contract-enforcing components."