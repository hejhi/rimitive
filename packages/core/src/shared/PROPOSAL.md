# Proposal: Addressing Type System Challenges in Lattice

## Executive Summary

This proposal outlines a comprehensive strategy for resolving the type system challenges in Lattice's composition framework. Our approach focuses on creating clearer boundaries between composition and runtime phases, simplifying the factory pattern, and leveraging TypeScript's newer features without adding external dependencies. The result will be a more type-safe API that's easier for developers to use while maintaining the power of Lattice's composition system.

## Background

As documented in the [type system analysis](packages/core/src/shared/TYPE_SYSTEM_ANALYSIS.md), Lattice faces several type system challenges:

1. **Function Composition vs. Factory Pattern Mismatch**: A disconnect between composition-time factory functions and runtime object access.
2. **Runtime Type Validation vs. Static Type Safety Tension**: Branded types create friction with TypeScript's static type system.
3. **Generic Type Parameter Preservation**: TypeScript struggles to maintain type relationships through composition chains.
4. **Multiple Layers of Indirection**: The factory pattern creates several function layers that TypeScript can't track effectively.

These issues manifest as type errors that prevent proper type inference and composition of components.

## Design Goals

1. **Maintain API Simplicity**: Keep the API simple for users, requiring at most one type parameter.
2. **Preserve Composition Power**: Maintain the current compositional capabilities of Lattice.
3. **Type Safety**: Improve type inference and eliminate the need for unsafe type assertions.
4. **Clear Phase Separation**: Create clearer boundaries between composition and runtime phases.
5. **No External Dependencies**: Implement solutions using only TypeScript's built-in features.

## Proposed Solutions

### 1. Phase-Aware Type System

We propose a fundamental architectural shift to explicitly model the composition and runtime phases in the type system:

```typescript
// Composition phase types (prefixed with "Composer")
export type ModelComposer<T> = Branded<{
  with<E>(extension: (base: T) => E): ModelComposer<T & E>;
  build(): ModelFactory<T>;
}, typeof MODEL_COMPOSER_BRAND>;

// Runtime phase types (prefixed with "Factory")
export type ModelFactory<T> = Branded<
  (tools: StoreFactoryTools<T>) => T,
  typeof MODEL_FACTORY_BRAND
>;
```

This explicit separation allows TypeScript to track type relationships more effectively by reducing the layers of indirection between phases.

### 2. Enhanced Type Extraction with Metadata

Instead of relying on complex type assertions, we'll add metadata properties to factory types:

```typescript
export type ModelFactory<T> = Branded<
  (tools: StoreFactoryTools<T>) => T,
  typeof MODEL_FACTORY_BRAND
> & {
  __MODEL_TYPE__: T;  // Metadata property for type extraction
};
```

This allows for more precise type extraction without runtime overhead:

```typescript
// Type extraction utility
type ExtractModelType<M> = M extends { __MODEL_TYPE__: infer T } ? T : never;
```

### 3. Simplified Factory Creation API

We'll simplify the factory creation process to reduce type complexity:

```typescript
// Current approach (complex)
export function createModel<T>(
  factory: (tools: ModelFactoryParams<T>) => T
): ModelFactory<T>;

// Simplified approach
export function createModel<T>(
  initialState: T
): ModelComposer<T>;
```

This makes the API more intuitive and reduces the need for complex type parameters.

### 4. Leveraging TypeScript 5.0+ Features

We'll leverage newer TypeScript features to improve type inference:

#### a. `const` Type Parameters

```typescript
export function compose<const T>(base: ModelFactory<T>) {
  return {
    with<const E>(extension: (base: T) => E): ModelFactory<T & E> {
      // Implementation
    }
  };
}
```

#### b. `satisfies` Operator

```typescript
export function createView<T>(factory: ViewFactory<T>) {
  return (params: ViewParams) => {
    const result = factory(params);
    return result satisfies T;
  };
}
```

#### c. Improved Conditional Types with `infer`

```typescript
type ExtractSelectors<V> = V extends ViewFactory<infer T, infer S, any> ? S : never;
type ExtractActions<V> = V extends ViewFactory<infer T, any, infer A> ? A : never;
```

### 5. Adapter Pattern for Factory-to-Runtime Transitions

To address the mismatch between factory functions and runtime objects, we'll introduce adapters:

```typescript
function adaptFactory<T, F extends Factory<T>>(factory: F): () => T {
  return () => {
    // Create a mock tools object for type extraction
    const mockTools = createMockTools<T>();
    return factory(mockTools as any);
  };
}
```

This eliminates the need for unsafe type assertions when transitioning between phases.

### 6. Revised `from` API

The `from` API will be redesigned to eliminate overload incompatibilities:

```typescript
// Single, unified from implementation
export function from<T>(source: AnyFactory<T>) {
  if (isModelFactory(source)) {
    return fromModel(source as ModelFactory<any>);
  }
  
  if (isSelectorsFactory(source)) {
    return fromSelectors(source as SelectorsFactory<any>);
  }
  
  throw new Error('Unsupported source type for from()');
}

// Type helper for AnyFactory
type AnyFactory<T> = ModelFactory<T> | SelectorsFactory<T>;
```

This approach unifies the implementation while preserving type safety.

## Implementation Plan

The implementation will proceed in several phases:

### Phase 1: Foundational Changes

1. Introduce phase-specific types (Composer vs Factory)
2. Add metadata properties to factory types
3. Implement adapter functions for phase transitions
4. Create mock tools for type extraction

### Phase 2: API Refactoring

1. Refactor the factory creation APIs
2. Implement the revised `from` API
3. Enhance the composition system with metadata preservation
4. Update the branding mechanism

### Phase 3: TypeScript Feature Adoption

1. Adopt `const` type parameters where beneficial
2. Implement `satisfies` operator for type checking
3. Enhance conditional types for better type extraction
4. Optimize for TypeScript 5.8's improved type inference

### Phase 4: Testing and Validation

1. Update and expand type tests
2. Ensure compatibility with existing code
3. Validate type inference in complex compositions
4. Measure impact on build performance

## API Migration Examples

### Current API

```typescript
// Create a model
const counterModel = createModel(({ set, get }) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));

// Create selectors
const counterSelectors = from(counterModel).createSelectors(({ model }) => ({
  count: () => model().count,
  isPositive: () => model().count > 0,
}));

// Create actions
const counterActions = from(counterModel).createActions(({ model }) => ({
  increment: () => model().increment(),
  reset: () => model().reset(),
}));

// Create a view
const counterView = from(counterSelectors)
  .withActions(counterActions)
  .createView(({ selectors, actions }) => ({
    "data-count": selectors().count,
    onClick: actions().increment,
  }));
```

### Proposed API

```typescript
// Create a model
const counterModel = createModel({
  count: 0,
  increment() { this.count += 1; },
  reset() { this.count = 0; },
});

// Create selectors
const counterSelectors = createSelectors(counterModel, (model) => ({
  count: () => model.count,
  isPositive: () => model.count > 0,
}));

// Create actions
const counterActions = createActions(counterModel, (model) => ({
  increment: () => model.increment(),
  reset: () => model.reset(),
}));

// Create a view
const counterView = createView(counterSelectors, counterActions, (selectors, actions) => ({
  "data-count": selectors.count,
  onClick: actions.increment,
}));
```

The proposed API is more direct, requires fewer type parameters, and provides better type inference.

## Conclusion

This proposal addresses the fundamental type system challenges in Lattice while maintaining its powerful composition capabilities. By creating clearer phase boundaries, simplifying the factory pattern, and leveraging TypeScript's newer features, we can significantly improve type safety and developer experience without compromising on API simplicity or adding external dependencies.

The result will be a more robust foundation for Lattice that better aligns with TypeScript's type system strengths, enabling developers to build complex, composable components with confidence in their type safety.
