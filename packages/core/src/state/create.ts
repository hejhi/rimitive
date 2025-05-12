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

      const toolsObj = (factorySpy.mock.calls[0] as any)[0];
      expect(isStateFactory(toolsObj)).toBe(true);

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const state = createState(() => ({ count: 1 }));
      const sliceCreator = state();

      // Should throw when get or derive are missing
      expect(() => sliceCreator({} as any)).toThrow(
        'State factory requires get and derive functions'
      );
      expect(() =>
        sliceCreator({ get: undefined, derive: vi.fn() } as any)
      ).toThrow('State factory requires get and derive functions');
      expect(() =>
        sliceCreator({ get: vi.fn(), derive: undefined } as any)
      ).toThrow('State factory requires get and derive functions');
    });

    it('should support the derive function', () => {
      // Create a mock model to derive from
      type MockModel = { count: number; computed: number };
      const mockModel: MockModel = {
        count: 10,
        computed: 20,
      };

      // Setup the derive function (mock, ignores transform for now)
      // TODO: Update this when the real derive implementation is available
      const mockDerive = vi.fn(<M, K extends keyof M>(model: M, key: K) => {
        return model[key];
      });

      // mockGet returns the full expected state shape
      const mockGet = vi.fn(() => ({
        derivedCount: 5,
        transformedCount: 20,
        combinedCount: 5,
      }));

      const state = createState<{
        derivedCount: number;
        transformedCount: number;
        combinedCount: number;
      }>(({ get, derive }) => ({
        derivedCount: derive(mockModel, 'count'),
        // Only call derive with two arguments to match the mock signature
        // TODO: When real derive is implemented, add transform support
        transformedCount: derive(mockModel, 'count'),
        combinedCount: get().derivedCount,
      }));

      const sliceCreator = state();
      const slice = sliceCreator({ get: mockGet, derive: mockDerive });

      // Verify derive was called
      expect(mockDerive).toHaveBeenCalled();
      expect(mockDerive).toHaveBeenCalledTimes(2); // Called for each usage

      // Verify the derived values
      expect(slice.combinedCount).toBe(5);
    });

    it('should work with the fluent compose API', async () => {
      const { compose } = await import('../shared/compose/fluent');

      // Create a base state
      const baseState = createState<{
        count: number;
        isPositive: () => boolean;
      }>(({ get }) => ({
        count: 0,
        isPositive: () => get().count > 0,
      }));

      // Compose them using fluent compose
      const enhancedState = compose(baseState).with<{
        doubled: () => number;
        formattedCount: () => string;
      }>(({ get }) => ({
        doubled: () => get().count * 2,
        formattedCount: () => `Count: ${get().count}`,
      }));

      // State should be a function
      expect(typeof enhancedState).toBe('function');

      // mockGet returns all properties expected by the composed state
      const mockGet = vi.fn(() => ({
        count: 5,
        isPositive: () => true,
        doubled: () => 10,
        formattedCount: () => 'Count: 5',
      }));
      const mockDerive = vi.fn(
        <M, K extends keyof M, R = M[K]>(
          model: M,
          key: K,
          transform?: (value: M[K]) => R
        ) => {
          const value = model[key];
          return transform ? transform(value) : value;
        }
      );

      // Create a slice with mock tools
      const sliceCreator = enhancedState();
      const slice = sliceCreator({ get: mockGet, derive: mockDerive });

      // Should have both the base and extension properties
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('isPositive');
      expect(slice).toHaveProperty('doubled');
      expect(slice).toHaveProperty('formattedCount');

      // Test the extension methods
      expect(slice.isPositive()).toBe(true);
      expect(slice.doubled()).toBe(10);
      expect(slice.formattedCount()).toBe('Count: 5');
    });

    it('should work with the prepare API', async () => {
      const { prepare, isPrepared } = await import('../shared/compose/prepare');

      // Create a state
      const state = createState<{ count: number; isPositive: () => boolean }>(
        ({ get }) => ({
          count: 0,
          isPositive: () => get().count > 0,
        })
      );

      // Prepare it
      const preparedState = prepare(state);

      // Should be a function
      expect(typeof preparedState).toBe('function');

      // Should be prepared
      expect(isPrepared(preparedState)).toBe(true);

      // mockGet returns all properties expected by the prepared state
      const mockGet = vi.fn(() => ({
        count: 5,
        isPositive: () => true,
      }));
      const mockDerive = vi.fn(
        <M, K extends keyof M, R = M[K]>(
          model: M,
          key: K,
          transform?: (value: M[K]) => R
        ) => {
          const value = model[key];
          return transform ? transform(value) : value;
        }
      );

      // Should still work as a state
      const sliceCreator = preparedState();
      const slice = sliceCreator({ get: mockGet, derive: mockDerive });

      // Test functionality
      expect(slice.count).toBe(0);
      expect(slice.isPositive()).toBe(true);
    });
  });
}
