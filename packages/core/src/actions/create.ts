import {
  ACTIONS_FACTORY_BRAND,
  ACTIONS_INSTANCE_BRAND,
  ActionsFactory,
  ActionsFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import { createModel } from '../model';

/**
 * Creates an actions factory.
 *
 * This is the primary API for creating actions in Lattice. Use it to define your
 * actions that delegate to model methods.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterActions = createActions(({ mutate }) => ({
 *   increment: mutate(counterModel).increment,
 *   decrement: mutate(counterModel).decrement,
 *   reset: mutate(counterModel).reset
 * }));
 *
 * // With composition
 * const enhancedActions = compose(counterActions).with(({ mutate }) => ({
 *   incrementTwice: mutate(enhancedModel).incrementTwice
 * }));
 * ```
 *
 * @param factory A function that produces an actions object with methods
 * @returns An actions instance function ready for composition
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
    // Create a real model for testing
    const model = createModel<{
      count: number;
      testMethod: () => void;
    }>(({ set, get }) => ({
      count: 0,
      testMethod: () => {
        set({ count: get().count + 1 });
      },
    }));

    // Create a spy factory to check it receives the mutate parameter
    const factorySpy = vi.fn(({ mutate }: ActionsFactoryTools) => ({
      testAction: mutate(model).testMethod,
    }));

    const actions = createActions(factorySpy);

    // Actions should be a function
    expect(typeof actions).toBe('function');

    // Should have lattice actions branding
    const { isActionInstance, isActionsFactory } = await import(
      '../shared/identify'
    );

    expect(isActionInstance(actions)).toBe(true);

    // TODO: Replace this simplified mock with actual implementation
    // that properly implements the dot-notation API and mutation branding
    const mockMutate = vi.fn().mockImplementation(() => ({
      // Mock a testMethod property that returns a branded function
      testMethod: vi.fn()
    }));

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
}
