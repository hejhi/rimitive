# Lattice Type System

## Overview

The Lattice type system is built around a contract-based composition pattern. It uses TypeScript's type system to enforce
type safety across component boundaries during composition.

## Type System Architecture

### Branded Types

The type system uses a "branded types" approach where types are tagged with unique symbols for runtime type identification:

```typescript
// Brand symbols for runtime type identification
export const MODEL_FACTORY_BRAND = Symbol('model-factory');
export const MODEL_INSTANCE_BRAND = Symbol('model-instance');
// ... other brand symbols

// Type utility for creating branded types
export type Branded<T, BrandSymbol extends symbol> = T & {
  readonly [key in BrandSymbol]: true;
};
```

This approach allows both compile-time and runtime type checking.

### Composition Flow

The composition system enables a fluent API with the `.with()` method:

1. **Creation Phase**: Factory functions create base components
2. **Composition Phase**: The `.with()` method extends components with new properties or behaviors
3. **Instantiation Phase**: Composed components are instantiated into Zustand stores

During this flow, the type system ensures that each phase maintains the appropriate type constraints.

### Factory Parameters

Factories use an object-parameter pattern for improved readability and type safety:

```typescript
// Object parameters with function-access pattern
export interface SelectorsFactoryParams<TModel> {
  model: () => TModel;
}

// Callback type with properly typed parameters
export type SelectorsFactoryCallback<T, TModel> = (
  params: SelectorsFactoryParams<TModel>
) => T;
```

### Factory Tools

Each factory type provides access to its dependencies through typed tool interfaces:

```typescript
// Model factory tools
export interface ModelFactoryTools<T> {
  get: GetState<T>;
  set: SetState<T>;
}

// Selectors factory tools
export interface SelectorsFactoryTools<TModel> {
  model: () => TModel;
}
```

### Type Bridging Adapters

Bridging adapters safely convert between different type contexts:

```typescript
// Example: Create a bridge between store context and model context
const modelGetter = () => get().model as TModel;

// Create selectors with properly typed model access
const result = selectorsFn({
  model: modelGetter,
  get: (() => get().model) as unknown as GetState<any>
});
```

These adapters ensure type safety while accommodating the different contexts in which components operate.

## Type Safety Strategies

The type system uses several strategies to ensure type safety:

1. **Generic Constraints**: Using extends constraints to ensure type compatibility
2. **Type Assertions**: Strategic use of `as` assertions only when type relationships are guaranteed
3. **Union Types**: Using union types to handle different possible values
4. **Adapter Types**: Creating adapter types to bridge between different type contexts
5. **Type Guards**: Runtime type checking using brand symbols

## Component Composition

Component composition maintains type safety through careful generic constraints:

```typescript
// Type-safe component composition callback
export type WithComponentCallback<
  TBaseModel,
  TBaseSelectors,
  TBaseActions,
  TBaseViews,
  TExtModel extends TBaseModel,
  TExtSelectors extends TBaseSelectors,
  TExtActions extends TBaseActions,
  TExtViews extends Record<string, unknown>
> = (
  elements: ComponentElements<...>
) => ComponentExtension<...>;
```

## Best Practices

1. **Explicit Generic Parameters**: Always provide explicit generic parameters when extending or composing components
2. **Use Adapters for Type Bridging**: Create explicit adapter types for bridging between different type contexts
3. **Minimize Type Assertions**: Use type assertions only when the relationship between types is guaranteed
4. **Prefer Extension Constraints**: Use `extends` constraints to ensure type compatibility
5. **Employ Type Guards**: Use runtime type checks via brand symbols when needed

## Future Enhancements

1. **Template Literal Types**: Using template literal types for improved error messages
2. **Conditional Types**: Leveraging conditional types for more precise type relationships
3. **Type Predicates**: Adding more type guard functions with type predicates
4. **Mapped Types**: Using mapped types to handle complex transformations between types

By following these patterns, the Lattice type system provides strong type safety while enabling flexible composition.