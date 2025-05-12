# TypeScript Implementation Plan for Lattice

This document outlines a systematic approach to add TypeScript typing to the Lattice codebase, following our recent API refactoring.

## Overview

We've successfully refactored the Lattice codebase to use a functional composition API instead of the previous fluent API with method chaining. This new API is cleaner, more explicit, and much easier to type. The core functional API consists of:

1. **`composeWith(base, extension)`**: Composes a base component with extensions
2. **`use(lattice, componentName, [viewName])`**: Extracts components from lattices
3. **`instantiate(component)`**: Finalizes a component for use

These functions, combined with our core factory functions (`createModel`, `createState`, `createAction`), provide a comprehensive and type-friendly API for building composable components.

## Implementation Plan

### Phase 1: Core Type Definitions

1. **Base Type Utilities**
   - Define branded type utilities for type safety
   - Create helper types for composition and extension
   - Add type guards for runtime validation

2. **Brand Symbols and Guards**
   - Type the brand symbols used for runtime identification
   - Add TypeScript typings to the type guards
   - Create helper types for branded objects

### Phase 2: Component Factory Types

1. **Model Factory Types**
   - Define `ModelFactory<T>` type with proper branding
   - Type the `createModel` function parameters and return value
   - Add typings for model tools (`get`, `set`)

2. **State Factory Types**
   - Define `StateFactory<T>` type with proper branding
   - Type the `createState` function parameters and return value
   - Add typings for state tools (`get`, `derive`)

3. **Action Factory Types**
   - Define `ActionFactory<T>` type with proper branding
   - Type the `createAction` function parameters and return value
   - Add typings for action tools (`mutate`)

### Phase 3: Composition Function Types

1. **ComposeWith Function**
   - Create polymorphic type for `composeWith` that works with all component types
   - Add typings that preserve and combine the types of base and extension
   - Add proper generic constraints for type safety

2. **Use Function**
   - Type the `use` function to extract components from lattices
   - Add proper typings for view namespacing support
   - Add type guards to ensure correct component usage

3. **Instantiate Function**
   - Type the `instantiate` function to work with all component types
   - Preserve component typing information in finalized instances
   - Add proper return type for finalized components

### Phase 4: Advanced Typing Features

1. **Cross-Component References**
   - Add typings for model references in actions and state
   - Type the reactive relationships between components
   - Add proper type inference for derived values

2. **Lattice Composition Types**
   - Type the `createLattice` function and its parameters
   - Add typings for lattice extension and composition
   - Create proper type relationships between lattice components

## Detailed Implementation Tasks

### Task 1: Type Definitions and Utilities

```typescript
// Add brand symbols typing
export const MODEL_FACTORY_BRAND: unique symbol;
export const STATE_FACTORY_BRAND: unique symbol;
export const ACTIONS_FACTORY_BRAND: unique symbol;
export const VIEW_FACTORY_BRAND: unique symbol;

export const MODEL_INSTANCE_BRAND: unique symbol;
export const STATE_INSTANCE_BRAND: unique symbol;
export const ACTIONS_INSTANCE_BRAND: unique symbol;
export const VIEW_INSTANCE_BRAND: unique symbol;

// Add branded type utilities
export type Branded<T, Brand extends symbol> = T & { readonly [key in Brand]: true };

// Component factory types
export type ModelFactory<T> = Branded<
  () => (options: ModelOptions) => T,
  typeof MODEL_INSTANCE_BRAND
>;

export type StateFactory<T> = Branded<
  () => (options: StateOptions) => T,
  typeof STATE_INSTANCE_BRAND
>;

export type ActionsFactory<T> = Branded<
  () => (options: ActionsOptions) => T,
  typeof ACTIONS_INSTANCE_BRAND
>;

// Tool types
export interface ModelOptions {
  get: () => any;
  set: (updater: ((state: any) => any) | any) => void;
}

export interface StateOptions {
  get: () => any;
  derive: <Model, Key extends keyof Model, Result = Model[Key]>(
    model: Model, 
    key: Key, 
    transform?: (value: Model[Key]) => Result
  ) => Result;
}

export interface ActionsOptions {
  mutate: <Model, Key extends keyof Model>(
    model: Model,
    key: Key
  ) => (...args: Parameters<Model[Key]>) => ReturnType<Model[Key]>;
}
```

### Task 2: Component Factory Functions

```typescript
/**
 * Create a model factory with proper typing
 */
export function createModel<T>(
  factory: (tools: ModelOptions) => T
): ModelFactory<T>;

/**
 * Create a state factory with proper typing
 */
export function createState<T>(
  factory: (tools: StateOptions) => T
): StateFactory<T>;

/**
 * Create an actions factory with proper typing
 */
export function createAction<T>(
  factory: (tools: ActionsOptions) => T
): ActionsFactory<T>;
```

### Task 3: Composition Function Types

```typescript
/**
 * Compose a component with an extension
 */
export function composeWith<
  T extends ModelFactory<any> | StateFactory<any> | ActionsFactory<any>,
  E
>(
  base: T,
  extension: (tools: InferToolsType<T>) => E
): T extends ModelFactory<infer M> 
  ? ModelFactory<M & E>
  : T extends StateFactory<infer S>
    ? StateFactory<S & E>
    : T extends ActionsFactory<infer A>
      ? ActionsFactory<A & E>
      : never;

/**
 * Infer the tools type based on the component type
 */
type InferToolsType<T> = T extends ModelFactory<any>
  ? ModelOptions
  : T extends StateFactory<any>
    ? StateOptions
    : T extends ActionsFactory<any>
      ? ActionsOptions
      : never;

/**
 * Extract a component from a lattice
 */
export function use<
  T extends Lattice,
  K extends keyof T
>(
  lattice: T,
  componentName: K
): T[K];

/**
 * Extract a view from a lattice
 */
export function use<
  T extends Lattice,
  K extends 'view',
  V extends keyof T[K]
>(
  lattice: T,
  componentName: K,
  viewName: V
): T[K][V];

/**
 * Finalize a component
 */
export function instantiate<T>(
  component: T
): T extends ModelFactory<infer M>
  ? FinalizedModelFactory<M>
  : T extends StateFactory<infer S>
    ? FinalizedStateFactory<S>
    : T extends ActionsFactory<infer A>
      ? FinalizedActionsFactory<A>
      : never;
```

## Challenging Areas & Solutions

### Challenge 1: Polymorphic Typing for composeWith

The `composeWith` function needs to work with different component types (models, states, actions, views) and preserve the correct typing for each.

**Solution**: Use conditional types and type inference to detect the component type and provide the appropriate tools and return type.

```typescript
function composeWith<Base, Ext>(
  base: Base,
  extension: (tools: InferToolsType<Base>) => Ext
): InferReturnType<Base, Ext>;

// Use conditional types to infer the correct return type
type InferReturnType<Base, Ext> = 
  Base extends ModelFactory<infer M> ? ModelFactory<M & Ext> :
  Base extends StateFactory<infer S> ? StateFactory<S & Ext> :
  Base extends ActionsFactory<infer A> ? ActionsFactory<A & Ext> :
  never;
```

### Challenge 2: Typed Component References

Components need to reference each other (e.g., actions reference model methods, state derives values from models).

**Solution**: Use indexed access types and conditional types to ensure references are type-safe.

```typescript
// Type-safe model method references in actions
type ModelMethod<M, K extends keyof M> = 
  M[K] extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : never;

// Type-safe derive function
type DeriveFunction = <
  M,
  K extends keyof M,
  R = M[K]
>(
  model: M,
  key: K,
  transform?: (value: M[K]) => R
) => R;
```

### Challenge 3: Lattice Component Relationships

The relationships between components in a lattice need to be preserved in the type system.

**Solution**: Use generic types to enforce relationships between lattice components.

```typescript
interface Lattice<
  M = any,
  S = any,
  A = any,
  V extends Record<string, any> = any
> {
  model: ModelFactory<M>;
  state: StateFactory<S>;
  actions: ActionsFactory<A>;
  view: V;
}

function createLattice<
  M,
  S,
  A,
  V extends Record<string, any>
>(
  name: string,
  components: {
    model: ModelFactory<M>;
    state: StateFactory<S>;
    actions: ActionsFactory<A>;
    view: V;
  }
): Lattice<M, S, A, V>;
```

## Conclusion

This implementation plan provides a systematic approach to adding TypeScript types to the refactored Lattice codebase. By focusing on the new functional API, we can create a strongly-typed system that preserves the composability and expressiveness of the library while providing excellent type safety and developer experience.

The types will be implemented incrementally, starting with the core type definitions and utilities, then moving to the component factory functions, and finally to the composition functions. This approach ensures that we can build on a solid foundation of types and gradually add more sophisticated typing features.