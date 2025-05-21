import {
  SELECTORS_FACTORY_BRAND,
  SelectorsFactoryParams,
  SelectorsSliceFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';

/**
 * Creates a selectors factory.
 *
 * This is the primary API for creating selectors in Lattice. Use it to define your
 * selectors' properties and derived values for accessing the model's state.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterSelectors = createSelectors(model, (getModel) => ({
 *   count: getModel().count,
 *   doubleCount: getModel().count * 2,
 *   isPositive: getModel().count > 0,
 *   formattedCount: `Count: ${getModel().count}`
 * }));
 * ```
 *
 * @param model The model that these selectors will derive from
 * @param factory A function that produces a selectors object with properties and values
 * @returns A selectors instance function that can be used with compose
 */
export function createSelectors<TSelectors, TModel>(
  params: { model: TModel },
  factory: SelectorsSliceFactory<TSelectors, TModel>
) {
  return brandWithSymbol(function selectorsFactory<
    S extends Partial<TSelectors> = TSelectors,
  >(selector?: (base: TSelectors) => S) {
    return (options: SelectorsFactoryParams<TModel>) => {
      // Ensure the required properties exist
      if (!options.model) {
        throw new Error('Selectors factory requires a model function');
      }

      // Create branded tools object with access functions for the factory
      const tools = {
        model: () => {
          if (params.model === undefined) {
            throw new Error('Model is required');
          }
          return params.model;
        },
      };

      // Call the factory with object parameters to match the spec
      const result = factory(tools);

      // If a selector is provided, apply it to filter properties
      if (selector) {
        return selector(result) as S;
      }

      // Otherwise return the full result
      return result as unknown as S;
    };
  }, SELECTORS_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createSelectors', async () => {
    const { isSelectorsFactory } = await import('../shared/identify');

    it('should verify selectors factory requirements and branding', () => {
      // Create mock model
      const mockModel = {
        count: 42,
        items: [{ name: 'item1' }, { name: 'item2' }],
      };

      // Create a spy factory
      const factorySpy = vi.fn((_tools) => ({
        count: mockModel.count,
        doubled: mockModel.count * 2,
        isPositive: mockModel.count > 0,
      }));

      const selectors = createSelectors({ model: mockModel }, factorySpy);

      // Selectors should be a function
      expect(typeof selectors).toBe('function');

      expect(isSelectorsFactory(selectors)).toBe(true);

      // Create a slice with the model
      const sliceCreator = selectors();
      const slice = sliceCreator({ model: () => mockModel });

      // Factory should be called with the model getter
      expect(factorySpy).toHaveBeenCalled();
      expect(slice).toEqual({
        count: 42,
        doubled: 84,
        isPositive: true,
      });

      // Verify the returned model is correct
      const modelParams = factorySpy.mock.calls[0]?.[0];
      expect(modelParams.model()).toBe(mockModel);
    });

    it('should throw an error when required tools are missing', () => {
      const selectors = createSelectors({ model: {} }, () => ({
        value: 'test',
      }));
      const sliceCreator = selectors();

      // Should throw when get is missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'Selectors factory requires a model function'
      );
    });

    it('should support filtering properties with slice parameter', () => {
      const mockModel = { count: 10, name: 'counter' };

      // Base selectors with all properties
      const baseSelectors = {
        count: mockModel.count,
        doubled: mockModel.count * 2,
        name: mockModel.name,
      };

      // Cherry-pick only some properties
      const enhancedSelectors = createSelectors(
        { model: mockModel },
        ({ model }) => ({
          name: baseSelectors.name, // Only keep name
          tripled: model().count * 3, // Add new property
        })
      );

      const sliceCreator = enhancedSelectors();
      const slice = sliceCreator({ model: () => mockModel });

      // Should contain only selected properties plus new ones
      expect(slice).toEqual({
        name: 'counter',
        tripled: 30,
      });
    });
  });
}
