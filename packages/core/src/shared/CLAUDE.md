# Shared - Core Utilities and Type System

The shared directory contains fundamental utilities and types that power the Lattice composition system. This includes the type system, composition functions, branding mechanisms, and utilities for creating the fluent API.

## Directory Structure

- **compose/**: Core composition mechanisms
  - **core.ts**: Base composition function `composeWith`
  - **fluent.ts**: Fluent API `compose(base).with()`
  - **prepare.ts**: Finalization function `prepare()`
  - **[component].ts**: Component-specific composition helpers
- **identify/**: Runtime type identification
  - **index.ts**: Type guards like `isModelInstance()` and branding utilities
- **types/**: Type definitions
  - **index.ts**: Branded types, factory types, instance types

## Key Concepts

### Type System

The type system uses branded types to enable runtime identification while maintaining type safety:

```typescript
// Brand symbols for runtime type identification
export const MODEL_INSTANCE_BRAND = Symbol('model-instance');

// Branded type utility
export type Branded<T, BrandSymbol extends symbol> = T & {
  readonly [key in BrandSymbol]: true;
};

// Usage
export type ModelInstance<T> = Branded<
  () => (options: ModelFactoryTools<T>) => T,
  typeof MODEL_INSTANCE_BRAND
>;
```

### Composition System

The composition system provides the building blocks for the fluent API:

```typescript
// Core composition function
export function composeWith<B, F>(base: ModelInstance<B>, extension: F):
  ModelInstance<B & InferExtension<F>>;

// Fluent composition API
export function compose<B>(base: ModelInstance<B>): {
  with<Ext>(cb: (tools: ModelFactoryTools<B & Ext>) => Ext):
    ModelInstance<B & Ext>;
};

// Preparation/finalization
export function prepare<T>(instance: ModelInstance<T>):
  PreparedModelInstance<T>;
```

### Identification System

The identification system allows for runtime type checking:

```typescript
// Type guard to check if a value is a model instance
export function isModelInstance<T = unknown>(value: unknown):
  value is ModelInstance<T>;

// Brand a value with a symbol
export function brandWithSymbol<T, M extends symbol>(value: T, symbol: M):
  Branded<T, M>;
```

## Implementation Details

- The composition system works on a two-level factory pattern
- Branding is used to ensure type safety across composition boundaries
- Type guards verify component types at runtime
- Generics provide proper type inference during composition
- Function overloading handles different component types
- Preparation/finalization prevents further changes to components

## Design Principles

1. **Type Safety**: All compositions are type-checked
2. **Runtime Verification**: Type guards ensure correct usage
3. **Immutability**: Prepared instances are immutable
4. **Composition**: Everything is composable and extensible
5. **Clean API**: The fluent API makes composition intent explicit

## Advanced Type Patterns

- **Conditional Types**: Used to infer extension types
- **Mapped Types**: Used for type transformations
- **Branded Types**: Used for nominal typing
- **Generic Inference**: Used for type flow through composition
- **Function Overloading**: Used for different component types

## Testing Utilities

The shared directory contains many in-source tests to verify the type system and composition mechanisms:

```typescript
// In-source tests for the type system
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should verify branded types at runtime', () => {
    const TEST_BRAND = Symbol('test');
    const regularFn = () => {};
    
    // Before branding
    expect(isLatticeObject(regularFn, TEST_BRAND)).toBe(false);
    
    // After branding
    const brandedFn = brandWithSymbol(regularFn, TEST_BRAND);
    expect(isLatticeObject(brandedFn, TEST_BRAND)).toBe(true);
  });
}
```