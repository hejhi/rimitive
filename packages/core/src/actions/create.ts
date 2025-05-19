import {
  ACTIONS_TOOLS_BRAND,
  ACTIONS_FACTORY_BRAND,
  ActionsFactoryParams,
  ActionsFactoryTools,
  ExtractModelType
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
 * const counterActions = createActions({ model: counterModel }, ({ model }) => ({
 *   increment: model().increment,
 *   decrement: model().decrement,
 *   reset: model().reset
 * }));
 *
 * // With composition
 * const enhancedActions = compose(counterActions).with(({ model }) => ({
 *   incrementTwice: model().incrementTwice
 * }));
 * ```
 *
 * @param params Object containing model to be used
 * @param factory Function that returns action methods
 * @returns An actions instance that can be composed
 */
// Allow specifying just T (actions type) and infer model instance type
export function createActions<T, TModel = any>(
  params: { model: TModel },
  factory: (tools: ActionsFactoryTools<ExtractModelType<TModel>>) => T
) {
  // Create a factory function that returns a slice creator
  const actionsFactory = function actionsFactory<S extends Partial<T> = T>(
    selector?: (base: T) => S
  ) {
    return (options: ActionsFactoryTools<TModel>) => {
      // Ensure the required properties exist
      if (!options.model) {
        throw new Error('Actions factory requires a model function');
      }

      // Create branded tools object for the factory with proper typing
      const tools = brandWithSymbol(
        {
          model: options.model as () => ExtractModelType<TModel>,
        },
        ACTIONS_TOOLS_BRAND
      );

      // Call the factory with object parameters to match the spec
      const result = factory(tools as ActionsFactoryTools<ExtractModelType<TModel>>);
      
      // If a selector is provided, apply it to filter properties
      if (selector) {
        return selector(result) as S;
      }
      
      // Otherwise return the full result
      return result as unknown as S;
    };
  };

  return brandWithSymbol(actionsFactory, ACTIONS_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createActions', async () => {
    const { isActionsFactory, isActionsTools } = await import(
      '../shared/identify'
    );

    it('should verify action factory requirements and branding', () => {
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

      // Create a spy factory to check it receives the model parameter
      const factorySpy = vi.fn(({ model }) => ({
        testAction: model().testMethod,
      }));

      const actions = createActions({ model }, factorySpy);

      // Actions should be a function
      expect(typeof actions).toBe('function');

      expect(isActionsFactory(actions)).toBe(true);

      // Create mock model function
      const mockModel = vi.fn().mockImplementation(() => ({
        testMethod: vi.fn(),
      }));

      // Create a slice with the mock model function
      const sliceCreator = actions();
      sliceCreator({ model: mockModel });

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Function),
        })
      );

      // The tools should be branded with the proper symbol
      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(isActionsTools(toolsObj)).toBe(true);
    });

    it('should throw an error when model function is missing', () => {
      const actions = createActions({ model: {} }, () => ({
        testAction: () => {},
      }));
      const sliceCreator = actions();

      // Should throw when model is missing
      expect(() => sliceCreator({ model: undefined as any })).toThrow(
        'Actions factory requires a model function'
      );
    });
  });
}
