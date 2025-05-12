import {
  ACTIONS_FACTORY_BRAND,
  ACTIONS_INSTANCE_BRAND,
  ActionsFactory,
  ActionsFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates an actions factory.
 *
 * This is the primary API for creating actions in Lattice. Use it to define your
 * actions that delegate to model methods. For composition, use the composeWith function.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterActions = createAction(({ mutate }) => ({
 *   increment: mutate(counterModel, "increment"),
 *   decrement: mutate(counterModel, "decrement"),
 *   reset: mutate(counterModel, "reset")
 * }));
 *
 * // With composition
 * const enhancedActions = composeWith(counterActions, ({ mutate }) => ({
 *   incrementTwice: mutate(enhancedModel, "incrementTwice")
 * }));
 *
 * // Finalize for use
 * const finalActions = instantiate(enhancedActions);
 * ```
 *
 * @param factory A function that produces an actions object with methods
 * @returns An actions instance function that can be used with composeWith and instantiate
 */
export function createActions<T>(factory: ActionsFactory<T>) {
  // Create a factory function that returns a slice creator
  const actionsFactory = function actionsFactory() {
    return (options: ActionsFactoryTools) => {
      // Ensure the required properties exist
      if (!options.mutate) {
        throw new Error('Actions factory requires a mutate function');
      }

      // Call the factory with the tools
      return factory(
        brandWithSymbol(
          {
            mutate: options.mutate,
          },
          ACTIONS_FACTORY_BRAND
        )
      );
    };
  };

  return brandWithSymbol(actionsFactory, ACTIONS_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should verify action factory requirements and branding', async () => {
    // Create a spy factory to check it receives the mutate parameter
    type MockModel = { testMethod: () => void };
    const factorySpy = vi.fn((tools: ActionsFactoryTools) => ({
      testAction: tools.mutate(
        { testMethod: vi.fn() } as MockModel,
        'testMethod'
      ),
    }));

    const actions = createActions(factorySpy);

    // Actions should be a function
    expect(typeof actions).toBe('function');

    // Should have lattice actions branding
    const { isActionInstance } = await import('../shared/identify');
    expect(isActionInstance(actions)).toBe(true);

    // Create a mutate function for testing
    const mockMutate = vi.fn();

    // Create a slice with the mock mutate function
    const sliceCreator = actions();
    sliceCreator({ mutate: mockMutate });

    // Factory should be called with branded tools
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mutate: expect.any(Function),
      })
    );

    // The tools should be branded with the proper symbol
    const { isActionsFactory } = await import('../shared/identify');
    const toolsObj = factorySpy.mock.calls[0]?.[0];
    expect(isActionsFactory(toolsObj)).toBe(true);
  });

  it('should throw an error when mutate function is missing', () => {
    const actions = createActions(() => ({ testAction: () => {} }));
    const sliceCreator = actions();

    // Should throw when mutate is missing
    expect(() => sliceCreator({ mutate: undefined as any })).toThrow(
      'Actions factory requires a mutate function'
    );
  });

  it('should work with the fluent compose API', async () => {
    // Import compose
    const { compose } = await import('../shared/compose/fluent');

    // Create a mock model
    type MockModel = {
      increment: () => void;
      incrementTwice: () => void;
    };
    const mockModel: MockModel = {
      increment: vi.fn(),
      incrementTwice: vi.fn(),
    };

    // Create a type-safe realMutate function (mock)
    // TODO: Replace this with the real mutate implementation when available
    const realMutate = (<M, K extends keyof M>(model: M, key: K) =>
      ((...args: any[]) => (model[key] as any)(...args)) as M[K] extends (
        ...args: infer P
      ) => infer R
        ? (...args: P) => R
        : never) as <M, K extends keyof M>(
      model: M,
      key: K
    ) => M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;

    // Create a base actions object
    const baseActions = createActions(({ mutate }) => ({
      increment: mutate(mockModel, 'increment'),
    }));

    // Compose them using fluent compose
    const enhancedActions = compose(baseActions).with<{
      incrementTwice: () => void;
    }>(({ mutate }) => ({
      incrementTwice: mutate(mockModel, 'incrementTwice'),
    }));

    // Actions should be a function
    expect(typeof enhancedActions).toBe('function');

    // Create a slice with the real mutate function
    const sliceCreator = enhancedActions();
    const actions = sliceCreator({ mutate: realMutate });

    // Should have both the base and extension properties
    expect(actions).toHaveProperty('increment');
    expect(actions).toHaveProperty('incrementTwice');

    // Should both be functions
    expect(typeof actions.increment).toBe('function');
    expect(typeof actions.incrementTwice).toBe('function');

    // Test the actions
    actions.increment();
    actions.incrementTwice();

    // Verify model methods were called
    expect(mockModel.increment).toHaveBeenCalled();
    expect(mockModel.incrementTwice).toHaveBeenCalled();
  });

  it('should work with the prepare API', async () => {
    // Import prepare
    const { prepare, isPrepared } = await import('../shared/compose/prepare');

    // Create a mock model
    type MockModel = {
      increment: () => void;
    };
    const mockModel: MockModel = {
      increment: vi.fn(),
    };

    // Create a type-safe realMutate function (mock)
    // TODO: Replace this with the real mutate implementation when available
    const realMutate = (<M, K extends keyof M>(model: M, key: K) =>
      ((...args: any[]) => (model[key] as any)(...args)) as M[K] extends (
        ...args: infer P
      ) => infer R
        ? (...args: P) => R
        : never) as <M, K extends keyof M>(
      model: M,
      key: K
    ) => M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never;

    // Create actions
    const actions = createActions(({ mutate }) => ({
      increment: mutate(mockModel, 'increment'),
    }));

    // Prepare it
    const preparedActions = prepare(actions);

    // Should be a function
    expect(typeof preparedActions).toBe('function');

    // Should be prepared
    expect(isPrepared(preparedActions)).toBe(true);

    // Should still work as actions
    const sliceCreator = preparedActions();
    // TODO: Remove 'as any' when real mutate is implemented
    const actionsSlice = sliceCreator({ mutate: realMutate as any });

    // Test functionality
    actionsSlice.increment();
    expect(mockModel.increment).toHaveBeenCalled();
  });
}
