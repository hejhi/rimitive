import {
  isModelInstance,
  isSelectorsInstance,
  isActionInstance,
  isViewInstance,
  brandWithSymbol,
} from '../identify';

import {
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
  StoreFactoryTools,
  MODEL_INSTANCE_BRAND,
} from '../types';

/**
 * Helper type to infer the return type of an extension function
 */
export type InferExtension<F> = F extends (tools: any) => infer R ? R : never;

/**
 * A unified composition function for all Lattice entities.
 * This is an internal implementation detail and should not be used directly.
 * Use the compose().with() fluent API instead.
 *
 * @internal
 * @param base The base component to extend (model, state, actions, or view)
 * @param extension A function that receives appropriate tools and returns extensions
 * @returns A new composed component combining the base and extensions
 */

// Import tools interfaces
import {
  ModelCompositionTools,
  SelectorsCompositionTools,
  ActionsCompositionTools,
  ViewCompositionTools,
} from '../types';

// When composing models, we now return a simple factory function, not a ModelInstance
export function composeWith<B, E>(
  base: ModelInstance<B>,
  extension: (tools: ModelCompositionTools<B, E>) => E
): (tools: StoreFactoryTools<B & E>) => B & E;

// When composing selectors, we now return a simple factory function
export function composeWith<B, E, TModel>(
  base: SelectorsInstance<B>,
  extension: (tools: SelectorsCompositionTools<TModel>) => E
): (options: { get: any }) => B & E;

// When composing actions, we now return a simple factory function
export function composeWith<B, E, TModel>(
  base: ActionsInstance<B>,
  extension: (tools: ActionsCompositionTools<TModel>) => E
): (options: { mutate: any }) => B & E;

// When composing views, we now return a simple factory function
export function composeWith<B, E, TSelectors, TActions>(
  base: ViewInstance<B>,
  extension: (tools: ViewCompositionTools<TSelectors, TActions>) => E
): (options: any) => B & E;

// Implementation using function overloading pattern
// B: Base type
// R: Result type
// extension composes the entire base and result. the user must specify the result only.
export function composeWith(base: any, shape: any): any {
  if (isModelInstance(base)) {
    // Return a factory function that createModel can use directly
    // This is a simplified version that avoids nested functions
    return ({ get, set }: StoreFactoryTools<any>) => {
      // When createModel calls this function with tools, we:
      // 1. Get the base slice from the base model (which is already a branded factory)
      const baseSlice = base()({ get, set });
      // 2. Get the extension slice by calling the extension function with the same tools
      const extensionSlice = shape({ get, set });
      // 3. Merge and return the combined result
      return { ...(baseSlice as object), ...(extensionSlice as object) };
    };
  }
  if (isSelectorsInstance(base)) {
    // Return a function that performs the composition
    return ({ get }: { get: any }) => {
      if (!get) {
        throw new Error('Selectors factory requires a get function');
      }
      // Get the base slice and extension slice
      const baseSlice = base()({ get });
      const extensionSlice = shape({ model: get });
      // Combine them
      return { ...(baseSlice as object), ...(extensionSlice as object) };
    };
  }
  if (isActionInstance(base)) {
    // Return a function that performs the composition
    return ({ mutate }: { mutate: any }) => {
      if (!mutate) {
        throw new Error('Actions factory requires mutate function');
      }
      // Get the base slice and extension slice
      const baseSlice = base()({ mutate });
      const extensionSlice = shape({ model: mutate });
      // Combine them
      return { ...(baseSlice as object), ...(extensionSlice as object) };
    };
  }
  if (isViewInstance(base)) {
    // Return a function that performs the composition
    return (options: any) => {
      // Get the base slice and extension slice
      const baseSlice = base()(options);
      const tools = {
        selectors: options.getSelectors || (() => ({})),
        actions: options.getActions || (() => ({})),
      };
      const extensionSlice = shape(tools);
      // Combine them
      return { ...(baseSlice as object), ...(extensionSlice as object) };
    };
  }
  throw new Error(
    'Invalid component: Must be a model, selectors, actions, or view'
  );
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should be defined', () => {
    expect(composeWith).toBeDefined();
  });

  it('should throw an error for invalid components', () => {
    const invalidComponent = {};
    const extension = () => ({});

    // @ts-expect-error
    expect(() => composeWith(invalidComponent, extension)).toThrow(
      'Invalid component: Must be a model, selectors, actions, or view'
    );
  });

  it('should compose a model with an extension (internal/advanced use)', () => {
    // Define the types we'll be working with
    type BaseModel = { count: number };

    // Create a mock model with the proper structure
    const mockModelFn = () => (_options: StoreFactoryTools<BaseModel>) => ({
      count: 1,
    });
    const brandedModel = brandWithSymbol(mockModelFn, MODEL_INSTANCE_BRAND);

    // Compose them with slice and tools object
    const composed = composeWith<BaseModel, { doubleCount: () => number }>(
      brandedModel,
      ({ get }) => ({
        doubleCount: () => get().count * 2,
      })
    );

    // Should be a function
    expect(typeof composed).toBe('function');

    // Check the composed functionality
    const mockGet = vi.fn(() => ({
      count: 2,
      doubleCount: () => 4,
    }));
    const mockSet = vi.fn();

    // This is a direct model factory, not an instance that needs to be called first
    const result = composed({ get: mockGet, set: mockSet });

    // Should have properties from both base and extension
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('doubleCount');
    expect(result.count).toBe(1);

    // Should work with the tools provided
    expect(typeof result.doubleCount).toBe('function');
    expect(result.doubleCount()).toBe(4); // 2 * 2
    expect(mockGet).toHaveBeenCalled();
  });
}
