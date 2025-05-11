import { markAsLatticeAction } from './identify';
import { createInstance } from '../shared/create';
import { brandWithSymbol } from '../shared/identify';
import { ACTIONS_FACTORY_BRAND } from '../shared';

/**
 * Creates a action instance function that serves as a blueprint for a set of actions.
 *
 * @param factory A function that produces an actions object with methods
 * @returns A action instance function that can be composed with other actions
 */
export function createActionInstance(factory) {
  function createActionSlice(options) {
    // Ensure the required properties exist
    if (!options.mutate) {
      throw new Error('Actions factory requires a mutate function');
    }

    // Brand the tools with the appropriate brand symbol
    const brandedTools = brandWithSymbol(
      {
        mutate: options.mutate,
      },
      ACTIONS_FACTORY_BRAND
    );

    // Call the factory with properly typed tools
    return factory(brandedTools);
  }

  // The createInstance returns a BaseInstance, but we need to add the actions-specific branding
  const instance = createInstance(
    createActionSlice,
    markAsLatticeAction,
    'actions',
    createAction
  );

  // Apply actions-specific branding to make it an ActionInstance
  return markAsLatticeAction(instance);
}

/**
 * Creates a factory function for a set of actions.
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
 * const extendedActions = counterActions.with(({ mutate }) => ({
 *   incrementTwice: mutate(enhancedModel, "incrementTwice")
 * }));
 *
 * // Finalize for use
 * const finalActions = extendedActions.create();
 * ```
 *
 * @param factory A function that produces an actions object with methods
 * @returns A action instance function that can be used in composition
 */
export function createAction(factory) {
  return createActionInstance(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should verify action factory requirements and branding', async () => {
    // Create a spy factory to check it receives the mutate parameter
    const factorySpy = vi.fn((tools) => ({
      testAction: tools.mutate({ testMethod: vi.fn() }, 'testMethod'),
    }));

    const actions = createAction(factorySpy);

    // Action should be a function (instance check)
    expect(typeof actions).toBe('function');

    // Should have lattice action branding (via markAsLatticeAction)
    // We need to check the proper symbol branding
    const { isActionInstance } = await import('../shared/identify');
    expect(isActionInstance(actions)).toBe(true);

    // Should have the expected API (.with and .create methods)
    expect(typeof actions.with).toBe('function');
    expect(typeof actions.create).toBe('function');

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

    // The mutate function should be branded with the ACTIONS_FACTORY_BRAND symbol
    const { isActionsFactory } = await import('../shared/identify');
    const mutateObj = factorySpy.mock.calls[0]?.[0];
    expect(isActionsFactory(mutateObj)).toBe(true);
  });

  it('should throw an error when mutate function is missing', () => {
    const actions = createAction(() => ({ testAction: () => {} }));
    const sliceCreator = actions();

    // Should throw when mutate is missing
    expect(() => sliceCreator({})).toThrow(
      'Actions factory requires a mutate function'
    );
    expect(() => sliceCreator({ mutate: undefined })).toThrow(
      'Actions factory requires a mutate function'
    );
  });
}
