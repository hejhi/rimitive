import {
  SELECTORS_FACTORY_BRAND,
  SELECTORS_TOOLS_BRAND,
  SelectorsFactory,
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
 * @param params The model that these selectors will derive from
 * @param factory A function that produces a selectors object with properties and values
 * @returns A selectors instance function that can be used with compose
 */
export function createSelectors<TSelectors, TModel = any>(
  params: { model: TModel },
  factory: SelectorsSliceFactory<TSelectors, TModel>
): SelectorsFactory<TSelectors, TModel> {
  return brandWithSymbol(function selectorsFactory<
    S extends Partial<TSelectors> = TSelectors,
  >(selector?: (base: TSelectors) => S) {
    return (options: SelectorsFactoryParams<TModel>) => {
      // Ensure the required properties exist
      if (!options.model) {
        throw new Error('Selectors factory requires a model function');
      }

      const result = factory(brandWithSymbol(options, SELECTORS_TOOLS_BRAND));

      // If a selector is provided, apply it to filter properties
      if (selector) return selector(result);

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
    const { createMockTools } = await import('../test-utils');

    it('should verify selectors factory requirements and branding', () => {
      // Use a simple mock model for this specific test
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

      // Use standardized mock tools
      const mockTools = createMockTools({
        model: () => mockModel,
      });

      // Create a slice with the model
      const sliceCreator = selectors();
      const slice = sliceCreator(mockTools);

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

      // Use standardized mock tools
      const mockTools = createMockTools({
        model: () => mockModel,
      });

      const sliceCreator = enhancedSelectors();
      const slice = sliceCreator(mockTools);

      // Should contain only selected properties plus new ones
      expect(slice).toEqual({
        name: 'counter',
        tripled: 30,
      });
    });
  });
}
