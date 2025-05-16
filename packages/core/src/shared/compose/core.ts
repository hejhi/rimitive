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
  SELECTORS_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
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

export function composeWith<B, E>(
  base: ModelInstance<B>,
  extension: (tools: ModelCompositionTools<B, E>) => E
): ModelInstance<B & E>;

export function composeWith<B, E, TModel>(
  base: SelectorsInstance<B>,
  extension: (tools: SelectorsCompositionTools<TModel>) => E
): SelectorsInstance<B & E>;

export function composeWith<B, E, TModel>(
  base: ActionsInstance<B>,
  extension: (tools: ActionsCompositionTools<TModel>) => E
): ActionsInstance<B & E>;

export function composeWith<B, E, TSelectors, TActions>(
  base: ViewInstance<B>,
  extension: (tools: ViewCompositionTools<TSelectors, TActions>) => E
): ViewInstance<B & E>;

// Implementation using function overloading pattern
// B: Base type
// R: Result type
// extension composes the entire base and result. the user must specify the result only.
export function composeWith(base: any, shape: any): any {
  if (isModelInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        if (!options.get || !options.set) {
          throw new Error('Model factory requires get and set functions');
        }
        const baseSlice = base()(options);
        const tools = {
          get: options.get,
          set: options.set,
        };
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      MODEL_INSTANCE_BRAND
    );
  }
  if (isSelectorsInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        if (!options.get) {
          throw new Error('Selectors factory requires a get function');
        }
        const baseSlice = base()(options);
        const tools = {
          model: options.get,
        };
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      SELECTORS_INSTANCE_BRAND
    );
  }
  if (isActionInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        if (!options.mutate) {
          throw new Error('Actions factory requires mutate function');
        }
        const baseSlice = base()(options);
        const tools = {
          model: options.mutate,
        };
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      ACTIONS_INSTANCE_BRAND
    );
  }
  if (isViewInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        const baseSlice = base()(options);
        const tools = {
          selectors: options.getSelectors || (() => ({})),
          actions: options.getActions || (() => ({})),
        };
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      VIEW_INSTANCE_BRAND
    );
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

    // Should be marked as a model instance
    expect(composed[MODEL_INSTANCE_BRAND]).toBe(true);

    // Check the composed functionality
    const factory = composed();
    const mockGet = vi.fn(() => ({
      count: 2,
      doubleCount: () => 4,
    }));
    const mockSet = vi.fn();

    const result = factory({ get: mockGet, set: mockSet });

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
