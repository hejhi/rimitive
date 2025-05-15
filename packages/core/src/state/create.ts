import {
  STATE_FACTORY_BRAND,
  STATE_INSTANCE_BRAND,
  SelectFactoryTools,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a state factory.
 *
 * This is the primary API for creating states in Lattice. Use it to define your
 * state's properties. For composition, use the fluent compose API.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterState = createState(({ get }) => ({
 *   count: 0,
 *   doubleCount: () => get().count * 2,
 *   formattedCount: () => `Count: ${get().count}`
 * }));
 *
 * // With composition
 * const enhancedState = compose(counterState).with<{ isPositive: () => boolean }>(
 *   ({ get }) => ({
 *     isPositive: () => get().count > 0,
 *   })
 * );
 * ```
 *
 * @param factory A function that produces a state object with properties and values
 * @returns A state instance function that can be used with compose
 */
export function createState<T>(factory: (tools: SelectFactoryTools<T>) => T) {
  // Create a factory function that returns a slice creator
  const stateFactory = function stateFactory() {
    return (options: SelectFactoryTools<T>) => {
      // Ensure the required properties exist
      if (!options.get) {
        throw new Error('State factory requires a get function');
      }

      // Call the factory with the tools
      return factory(
        brandWithSymbol({ get: options.get }, STATE_FACTORY_BRAND)
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

    it('should verify view factory requirements and branding', () => {
      // Create a spy factory
      const factorySpy = vi.fn((_: SelectFactoryTools<{ count: number }>) => ({
        count: 1,
      }));

      const state = createState(factorySpy);

      // View should be a function
      expect(typeof state).toBe('function');

      expect(isStateInstance(state)).toBe(true);

      // Create tools for testing
      const mockGet = vi.fn();

      // Create a slice with the mock tools
      const sliceCreator = state();
      const slice = sliceCreator({ get: mockGet });

      // Factory should be called with the tools
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          get: mockGet,
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

      // Should throw when get or set are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'State factory requires a get function'
      );
    });
  });
}
