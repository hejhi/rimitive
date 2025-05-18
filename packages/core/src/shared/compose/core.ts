import {
  isModelFactory,
  isSelectorsFactory,
  isActionsFactory,
  isViewFactory, 
  brandWithSymbol
} from '../identify';

import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  StoreFactoryTools,
  MODEL_FACTORY_BRAND
} from '../types';

// Define the ViewParamsToToolsAdapter to represent view tools
interface ViewParamsToToolsAdapter<TSelectors = unknown, TActions = unknown> {
  getSelectors?: () => TSelectors;
  getActions?: () => TActions;
}

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

// When composing models, we now return a simple factory function, not a factory
export function composeWith<B, E>(
  base: ModelFactory<B>,
  extension: (tools: ModelCompositionTools<B, E>) => E
): (tools: StoreFactoryTools<B & E>) => B & E;

// When composing selectors, we now return a simple factory function
export function composeWith<B, E, TModel>(
  base: SelectorsFactory<B>,
  extension: (tools: SelectorsCompositionTools<TModel>) => E
): (options: { get: any }) => B & E;

// When composing actions, we now return a simple factory function
export function composeWith<B, E, TModel>(
  base: ActionsFactory<B>,
  extension: (tools: ActionsCompositionTools<TModel>) => E
): (options: { mutate: any }) => B & E;

// When composing views, we now return a simple factory function
export function composeWith<B, E, TSelectors, TActions>(
  base: ViewFactory<B>,
  extension: (tools: ViewCompositionTools<TSelectors, TActions>) => E
): (options: any) => B & E;

// Implementation using function overloading pattern
// B: Base type
// R: Result type
// extension composes the entire base and result. The user must specify the result only.
// Implementation with type discrimination
// Each overload case is handled by checking the input type
export function composeWith<B, E>(
  base: ModelFactory<B> | SelectorsFactory<B> | ActionsFactory<B> | ViewFactory<B>,
  shape: unknown
): unknown {
  if (isModelFactory<B>(base)) {
    // Return a factory function that createModel can use directly
    // This is a simplified version that avoids nested functions
    return ({ get, set }: StoreFactoryTools<B & E>) => {
      // When createModel calls this function with tools, we:
      // 1. Get the base slice from the base model (which is already a branded factory)
      const baseSlice = base()({ get, set });
      // 2. Get the extension slice by calling the extension function with the same tools
      const extensionSlice = (shape as (tools: ModelCompositionTools<B, E>) => E)({ get, set });
      // 3. Merge and return the combined result with proper typing
      return { ...baseSlice, ...extensionSlice };
    };
  }
  if (isSelectorsFactory<B>(base)) {
    // Return a function that performs the composition
    return ({ get }: { get: () => B }) => {
      if (!get) {
        throw new Error('Selectors factory requires a get function');
      }
      // Get the base slice and extension slice
      const baseSlice = base()({ get });
      const extensionSlice = (shape as (tools: SelectorsCompositionTools<unknown>) => E)({ model: get as () => unknown });
      // Combine them with proper typing
      return { ...baseSlice, ...extensionSlice };
    };
  }
  if (isActionsFactory<B>(base)) {
    // Define a safer type for Actions factory tools
    type ActionsMutateFunction = {
      mutate: <M>(model: M) => any;
    };
    
    // Return a function that performs the composition 
    return (options: ActionsMutateFunction) => {
      if (!options.mutate) {
        throw new Error('Actions factory requires mutate function');
      }
      // Get the base slice and extension slice 
      const baseSlice = base()(options);
      // For the extension, we create a compatible tools object
      // We need to wrap the mutate function to make it compatible with the expected model() format
      const model = function() { 
        return options.mutate;
      };
      
      // Cast is required here due to the generic nature of the function
      const extensionSlice = (shape as (tools: ActionsCompositionTools<unknown>) => E)({ 
        model 
      });
      // Combine them with proper typing
      return { ...baseSlice, ...extensionSlice };
    };
  }
  if (isViewFactory<B>(base)) {
    // Return a function that performs the composition
    return (options: ViewParamsToToolsAdapter<unknown, unknown>) => {
      // Use a runtime check for the ViewFactory API compatibility
      const viewOptions = options as Record<string, unknown>;
      // Get the base slice and extension slice - we need to use any here
      // due to the fundamental mismatch between ViewFactory and ViewParamsToToolsAdapter
      const baseSlice = base()(viewOptions as any);
      
      // Create consistent tools object for the extension function
      const tools = {
        selectors: options.getSelectors || (() => ({})),
        actions: options.getActions || (() => ({})),
      };
      const extensionSlice = (shape as (tools: ViewCompositionTools<unknown, unknown>) => E)(tools);
      // Combine them with proper typing
      return { ...baseSlice, ...extensionSlice };
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
    const brandedModel = brandWithSymbol(mockModelFn, MODEL_FACTORY_BRAND);

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

    // This is a direct model factory, not a factory that needs to be called first
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
