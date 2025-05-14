import {
  STATE_FACTORY_BRAND,
  STATE_INSTANCE_BRAND,
  StateFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a state factory.
 *
 * This is the primary API for creating states in Lattice. Use it to define your
 * state's properties and derived values. For composition, use the fluent compose API.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterState = createState(({ get, derive }) => ({
 *   count: 0,
 *   doubleCount: () => get().count * 2,
 *   modelData: derive(counterModel, 'data'),
 *   formattedCount: () => `Count: ${get().count}`
 * }));
 *
 * // With composition
 * const enhancedState = compose(counterState).with<{ isPositive: () => boolean }>(
 *   ({ get }) => ({
 *     isPositive: () => get().count > 0,
 *   })
 * );
 *
 * // Prepare for use
 * const preparedState = prepare(enhancedState);
 * ```
 *
 * @param factory A function that produces a state object with properties and derived values
 * @returns A state instance function that can be used with compose and prepare
 */
export function createState<T>(factory: (tools: StateFactoryTools<T>) => T) {
  // Create a factory function that returns a slice creator
  const stateFactory = function stateFactory() {
    return (options: StateFactoryTools<T>) => {
      // Ensure the required properties exist
      if (!options.get || !options.derive) {
        throw new Error('State factory requires get and derive functions');
      }

      // Call the factory with the tools
      return factory(
        brandWithSymbol(
          {
            get: options.get,
            derive: options.derive,
          },
          STATE_FACTORY_BRAND
        )
      );
    };
  };

  return brandWithSymbol(stateFactory, STATE_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createState', async () => {
    const { isStateInstance, isStateFactory } = await import(
      '../shared/identify'
    );

    it('should verify state factory requirements and branding', () => {
      // Create a spy factory
      const factorySpy = vi.fn((_: StateFactoryTools<{ count: number }>) => ({
        count: 1,
      }));

      const state = createState(factorySpy);

      // State should be a function
      expect(typeof state).toBe('function');

      expect(isStateInstance(state)).toBe(true);

      // Create tools for testing
      const mockGet = vi.fn();
      const mockDerive = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = state();
      const slice = sliceCreator({ get: mockGet, derive: mockDerive });

      // Factory should be called with the tools
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          get: mockGet,
          derive: mockDerive,
        })
      );

      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(isStateFactory(toolsObj)).toBe(true);

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const state = createState(() => ({ count: 1 }));
      const sliceCreator = state();

      // Should throw when get or derive are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'State factory requires get and derive functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: undefined, derive: vi.fn() })).toThrow(
        'State factory requires get and derive functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: vi.fn(), derive: undefined })).toThrow(
        'State factory requires get and derive functions'
      );
    });
  });
}
