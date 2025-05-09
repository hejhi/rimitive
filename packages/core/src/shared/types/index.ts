/**
 * Import Zustand types for better type safety
 */
import type { StoreApi } from 'zustand';

/**
 * Type for the Zustand get function - extracts the state type from a store
 */
export type GetState<T> = StoreApi<T>['getState'];

/**
 * Type for the Zustand set function - extracts the setState type from a store
 */
export type SetState<T> = StoreApi<T>['setState'];

/**
 * Type for a factory function used by both models and states
 */
export type Factory<T> = {
  get: GetState<T>;
  set: SetState<T>;
};

/**
 * Type for an instance (model or state), which is a function that returns a slice creator
 * T represents the slice of state this instance contributes
 */
export type Instance<T, F = unknown> = {
  (): SliceCreator<T>;
  __composition?: unknown;
  with<U>(
    factory: (tools: Factory<ComposedState<T, U>>) => U
  ): Instance<ComposedState<T, U>, F>;
  create(): Finalized<T>;
};

/**
 * Type for a finalized instance, which can no longer be composed but is ready for use
 * This type represents the end of the composition phase
 */
export type Finalized<T> = {
  (): SliceCreator<T>;
  __finalized: true;
};

/**
 * Type for a slice creator function that Zustand will call
 */
export type SliceCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

/**
 * Utility type to extract the state type from an Instance
 */
export type InstanceState<T extends Instance<any>> =
  T extends Instance<infer S> ? S : never;

/**
 * Utility type for composing two state types
 */
export type ComposedState<T, U> = T & U;

/**
 * Utility type for a composed instance
 */
export type ComposedInstance<
  T extends Instance<any>,
  U extends Instance<any>,
  F = unknown,
> = Instance<ComposedState<InstanceState<T>, InstanceState<U>>, F>;

// In-source tests
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should compile with correct type inference', () => {
    // This test is type-level only
    type TestState = {
      count: number;
      increment: () => void;
    };

    type TestInstance = Instance<TestState>;

    // The type should be a function
    const isFunction: TestInstance extends Function ? true : false = true;
    expect(isFunction).toBe(true);

    // It should have .with and .create methods
    type HasWithMethod = TestInstance extends { with: Function } ? true : false;
    type HasCreateMethod = TestInstance extends { create: Function }
      ? true
      : false;

    const hasWithMethod: HasWithMethod = true;
    const hasCreateMethod: HasCreateMethod = true;

    expect(hasWithMethod).toBe(true);
    expect(hasCreateMethod).toBe(true);
  });
}
