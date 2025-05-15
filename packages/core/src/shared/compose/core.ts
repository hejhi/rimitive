import {
  isModelInstance,
  isStateInstance,
  isActionInstance,
  isViewInstance,
  brandWithSymbol,
} from '../identify';

import {
  ModelInstance,
  StateInstance,
  ActionsInstance,
  ViewInstance,
  ActionsFactoryTools,
  StoreFactoryTools,
  MODEL_INSTANCE_BRAND,
  MODEL_FACTORY_BRAND,
  STATE_FACTORY_BRAND,
  STATE_INSTANCE_BRAND,
  ACTIONS_FACTORY_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_FACTORY_BRAND,
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

// Model
export function composeWith<
  B,
  F extends (tools: StoreFactoryTools<any>) => any,
>(base: ModelInstance<B>, extension: F): ModelInstance<B & InferExtension<F>>;

// State
export function composeWith<
  B,
  F extends (tools: StoreFactoryTools<any>) => any,
>(base: StateInstance<B>, extension: F): StateInstance<B & InferExtension<F>>;

// Actions
export function composeWith<B, F extends (tools: ActionsFactoryTools) => any>(
  base: ActionsInstance<B>,
  extension: F
): ActionsInstance<B & InferExtension<F>>;

// View
export function composeWith<
  B,
  F extends (tools: StoreFactoryTools<B & InferExtension<F>>) => any,
>(base: ViewInstance<B>, extension: F): ViewInstance<B & InferExtension<F>>;

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
        const tools = brandWithSymbol(
          { get: options.get, set: options.set },
          MODEL_FACTORY_BRAND
        );
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      MODEL_INSTANCE_BRAND
    );
  }
  if (isStateInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        if (!options.get) {
          throw new Error('State factory requires a get function');
        }
        const baseSlice = base()(options);
        const tools = brandWithSymbol(
          { get: options.get },
          STATE_FACTORY_BRAND
        );
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      STATE_INSTANCE_BRAND
    );
  }
  if (isActionInstance(base)) {
    return brandWithSymbol(
      () => (options: any) => {
        if (!options.mutate) {
          throw new Error('Actions factory requires mutate function');
        }
        const baseSlice = base()(options);
        const tools = brandWithSymbol(
          { mutate: options.mutate },
          ACTIONS_FACTORY_BRAND
        );
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
        const tools = brandWithSymbol(
          { dispatch: options.dispatch },
          VIEW_FACTORY_BRAND
        );
        const extensionSlice = shape(tools);
        return { ...(baseSlice as object), ...(extensionSlice as object) };
      },
      VIEW_INSTANCE_BRAND
    );
  }
  throw new Error(
    'Invalid component: Must be a model, state, actions, or view'
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
      'Invalid component'
    );
  });

  it('should compose a model with an extension (internal/advanced use)', () => {
    // Create a mock model
    const baseModel = brandWithSymbol(
      () => ({ count: 1 }),
      MODEL_INSTANCE_BRAND
    );
    const brandedModel = brandWithSymbol(() => baseModel, MODEL_INSTANCE_BRAND);

    // Compose them
    const composed = composeWith(brandedModel, ({ get }) => ({
      doubleCount: () => get().count * 2,
    }));

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
