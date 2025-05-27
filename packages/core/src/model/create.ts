import {
  MODEL_TOOLS_BRAND,
  MODEL_FACTORY_BRAND,
  ModelSliceFactory,
  ModelFactoryParams,
  ModelFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import type { Enhancer, WithEnhancers } from '../shared/enhancers';
import { attachEnhancers } from '../shared/enhancers';

/**
 * Enhanced model factory that includes .with() method
 */
export type EnhancedModelFactory<T, TEnhancers extends ReadonlyArray<Enhancer> = []> = 
  ModelFactory<T> & WithEnhancers<ModelFactory<T>, TEnhancers>;

/**
 * Creates a model factory.
 *
 * This is the primary API for creating models in Lattice. Use it to define your
 * model's state, actions, and derived values.
 *
 * @param sliceFactory A function that produces a state object with optional methods and derived properties
 * @returns A model factory function that can be composed with enhancers
 */
export function createModel<TModel>(
  sliceFactory: ModelSliceFactory<TModel>
): EnhancedModelFactory<TModel, []> {
  const baseFactory = brandWithSymbol(function modelFactory<
    S extends Partial<TModel> = TModel,
  >(selector?: (base: TModel) => S) {
    return (options: ModelFactoryParams<TModel>) => {
      // Ensure the required properties exist
      if (!options.get || !options.set) {
        throw new Error('Model factory requires get and set functions');
      }

      // Call the factory with object parameters to match the spec
      const result = sliceFactory(brandWithSymbol(options, MODEL_TOOLS_BRAND));

      // If a selector is provided, apply it to filter properties
      if (selector) return selector(result);

      // Otherwise return the full result
      return result as unknown as S;
    };
  }, MODEL_FACTORY_BRAND);

  // Add enhancers support using the functional approach
  return attachEnhancers(baseFactory, [] as []);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createModel', async () => {
    const { isModelFactory } = await import('../shared/identify');
    const { createMockTools } = await import('../test-utils');

    it('should verify model factory requirements and branding', () => {
      // Create a spy factory with object parameters
      const factorySpy = vi.fn((_tools) => ({
        count: 1,
      }));

      const model = createModel(factorySpy);

      // Model should be a function
      expect(typeof model).toBe('function');

      expect(isModelFactory(model)).toBe(true);

      // Use standardized mock tools
      const mockTools = createMockTools({
        get: vi.fn(),
        set: vi.fn(),
      });

      // Create a slice with the mock tools
      const sliceCreator = model();
      const slice = sliceCreator(mockTools);

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.any(Function),
          get: expect.any(Function),
        })
      );

      // The tools should be properly structured
      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(toolsObj).toHaveProperty('set');
      expect(toolsObj).toHaveProperty('get');
      expect(typeof toolsObj.set).toBe('function');
      expect(typeof toolsObj.get).toBe('function');

      // Verify slice contains the expected value
      expect(slice).toEqual({ count: 1 });
    });

    it('should throw an error when required tools are missing', () => {
      const model = createModel(() => ({ count: 1 }));
      const sliceCreator = model();

      // Should throw when get or set are missing
      // @ts-expect-error
      expect(() => sliceCreator({})).toThrow(
        'Model factory requires get and set functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: undefined, set: vi.fn() })).toThrow(
        'Model factory requires get and set functions'
      );

      // @ts-expect-error
      expect(() => sliceCreator({ get: vi.fn(), set: undefined })).toThrow(
        'Model factory requires get and set functions'
      );
    });

    it('should support .with() for adding enhancers', async () => {
      const { derive, combine } = await import('../shared/enhancers/index');

      // Create model with enhancers using .with()
      type TestModel = {
        firstName: string;
        lastName: string;
        age: number;
        items: Array<{ id: string; price: number }>;
        setFirstName: (name: string) => void;
        setLastName: (name: string) => void;
        addItem: (item: { id: string; price: number }) => void;
      };
      
      const enhancedModel = createModel<TestModel>(({ set, get }) => ({
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        items: [] as Array<{ id: string; price: number }>,
        setFirstName: (name: string) => set({ firstName: name }),
        setLastName: (name: string) => set({ lastName: name }),
        addItem: (item: { id: string; price: number }) => 
          set({ items: [...get().items, item] }),
      })).with(derive, combine);

      // The model should now have enhancers attached
      // We need to use getEnhancers helper to check
      const { getEnhancers } = await import('../shared/enhancers');
      const enhancers = getEnhancers(enhancedModel);
      expect(enhancers).toContain(derive);
      expect(enhancers).toContain(combine);

      // When used in selectors, enhancers are available
      // TODO: This will work when selectors support the new API
      /*
      const selectors = createSelectors(enhancedModel, 
        ({ model }, { derive, combine }) => ({
          // Use derive for computed values
          fullName: derive(
            () => `${model().firstName} ${model().lastName}`,
            (name: string) => name.trim()
          ),
          
          // Use combine for multiple dependencies
          userInfo: combine(
            () => model().fullName,
            () => model().age,
            (name: string, age: number) => `${name} (${age} years old)`
          ),
          
          // Derive can handle complex computations
          totalPrice: derive(
            () => model().items,
            (items: Array<{ id: string; price: number }>) => items.reduce((sum, item) => sum + item.price, 0)
          ),
        })
      );

      // Test that it works at runtime
      const mockTools = createMockTools();
      const modelInstance = enhancedModel(mockTools);
      const selectorsInstance = selectors()({ model: () => modelInstance });

      expect(selectorsInstance.fullName).toBe('John Doe');
      expect(selectorsInstance.userInfo).toBe('John Doe (30 years old)');
      expect(selectorsInstance.totalPrice).toBe(0);

      // Update model and verify derived values update
      modelInstance.setFirstName('Jane');
      modelInstance.addItem({ id: '1', price: 99.99 });
      
      const updated = selectors()({ model: () => modelInstance });
      expect(updated.fullName).toBe('Jane Doe');
      expect(updated.userInfo).toBe('Jane Doe (30 years old)');
      expect(updated.totalPrice).toBe(99.99);
      */

      // Chain multiple .with() calls
      const lens: Enhancer<'lens', unknown> = { 
        name: 'lens' as const, 
        create: () => ({}) 
      };
      const trace: Enhancer<'trace', unknown> = { 
        name: 'trace' as const, 
        create: () => ({}) 
      };
      
      const superEnhanced = createModel(() => ({
        value: 0
      }))
        .with(derive, combine)
        .with(lens)
        .with(trace);
        
      const superEnhancers = getEnhancers(superEnhanced);
      expect(superEnhancers).toHaveLength(4);
      expect(superEnhancers).toContain(lens);
      expect(superEnhancers).toContain(trace);
    });
  });
}
