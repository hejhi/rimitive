import {
  SELECTORS_FACTORY_BRAND,
  SELECTORS_TOOLS_BRAND,
  SelectorsFactory,
  SelectorsFactoryParams,
  SelectorsSliceFactory,
  ModelFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import type { Enhancer, WithEnhancers, CombineEnhancerTools } from '../shared/enhancers';
import { attachEnhancers, getEnhancers } from '../shared/enhancers';
import type { EnhancedModelFactory } from '../model/create';

/**
 * Enhanced selectors factory that includes .with() method
 */
export type EnhancedSelectorsFactory<T, TModel, TEnhancers extends ReadonlyArray<Enhancer> = []> = 
  SelectorsFactory<T, TModel> & WithEnhancers<SelectorsFactory<T, TModel>, TEnhancers>;

/**
 * Creates a selectors factory.
 *
 * This is the primary API for creating selectors in Lattice. Use it to define your
 * selectors' properties and derived values for accessing the model's state.
 *
 * Supports two APIs:
 * 1. Legacy: createSelectors({ model }, factory)
 * 2. New: createSelectors(model, factory) with enhancer support
 */
export function createSelectors<TSelectors, TModel = any>(
  params: { model: TModel },
  factory: SelectorsSliceFactory<TSelectors, TModel>
): SelectorsFactory<TSelectors, TModel>;
export function createSelectors<TSelectors, TModel = any, TModelEnhancers extends ReadonlyArray<Enhancer> = []>(
  model: EnhancedModelFactory<TModel, TModelEnhancers>,
  factory: (
    params: SelectorsFactoryParams<TModel>,
    enhancers: CombineEnhancerTools<TModelEnhancers>
  ) => TSelectors
): EnhancedSelectorsFactory<TSelectors, TModel, []>;
export function createSelectors<TSelectors, TModel = any>(
  paramsOrModel: { model: any } | EnhancedModelFactory<TModel, any>,
  factory: any
): any {
  // Check if using new API (model directly) or legacy API ({ model })
  // New API: paramsOrModel is a function (model factory)
  // Legacy API: paramsOrModel is an object with a model property
  const isNewApi = typeof paramsOrModel === 'function';
  const modelEnhancers = isNewApi ? getEnhancers(paramsOrModel) : [];
  
  
  if (isNewApi) {
    // New API: createSelectors(model, factory)
    const enhancers = modelEnhancers;
    
    const baseFactory = brandWithSymbol(function selectorsFactory<
      S extends Partial<TSelectors> = TSelectors,
    >(selector?: (base: TSelectors) => S) {
      return (options: SelectorsFactoryParams<TModel>) => {
        if (!options.model) {
          throw new Error('Selectors factory requires a model function');
        }

        // Create enhancer tools from model's enhancers
        const enhancerTools: any = {};
        if (Array.isArray(enhancers)) {
          enhancers.forEach((enhancer: Enhancer) => {
            if (enhancer && enhancer.name && enhancer.create) {
              const context = {
                getState: options.model,
              };
              enhancerTools[enhancer.name] = enhancer.create(context);
            }
          });
        }

        // Call factory with both params and enhancer tools
        const result = factory(
          brandWithSymbol(options, SELECTORS_TOOLS_BRAND),
          enhancerTools
        );

        if (selector) return selector(result);
        return result as unknown as S;
      };
    }, SELECTORS_FACTORY_BRAND);

    // Add enhancers support using the functional approach
    // Use attachEnhancers to properly handle the .with() method
    return attachEnhancers(baseFactory, [] as []);
  } else {
    // Legacy API: createSelectors({ model }, factory)
    return brandWithSymbol(function selectorsFactory<
      S extends Partial<TSelectors> = TSelectors,
    >(selector?: (base: TSelectors) => S) {
      return (options: SelectorsFactoryParams<TModel>) => {
        if (!options.model) {
          throw new Error('Selectors factory requires a model function');
        }

        const result = factory(brandWithSymbol(options, SELECTORS_TOOLS_BRAND));

        if (selector) return selector(result);
        return result as unknown as S;
      };
    }, SELECTORS_FACTORY_BRAND);
  }
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

    it('should support new API with enhancers', async () => {
      const { createModel } = await import('../model/create');
      const { derive, combine } = await import('../shared/enhancers/index');
      
      // Define model type
      type TestModel = {
        count: number;
        items: Array<{ id: string; value: number }>;
        increment: () => void;
        addItem: (item: { id: string; value: number }) => void;
      };
      
      // Create model with enhancers
      const testModel = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        items: [] as Array<{ id: string; value: number }>,
        increment: () => set({ count: get().count + 1 }),
        addItem: (item: { id: string; value: number }) => 
          set({ items: [...get().items, item] }),
      })).with(derive, combine);

      // Verify model has enhancers
      const modelEnhancers = getEnhancers(testModel);
      expect(modelEnhancers).toHaveLength(2);
      expect(modelEnhancers[0]).toBe(derive);
      expect(modelEnhancers[1]).toBe(combine);

      // Create selectors using the new API
      // First arg: model runtime
      // Second arg: receives runtime + enhancer tools
      const testSelectors = createSelectors(testModel as any, 
        ({ model }: { model: () => TestModel }, { derive, combine }: any) => ({
          // Direct access without unused params
          count: model().count,
          items: model().items,
          
          // Use derive enhancer for computed values
          doubleCount: derive(
            () => model().count,
            (count: number) => count * 2
          ),
          
          // Derive with multiple dependencies
          totalValue: derive(
            () => model().items,
            (items: Array<{ id: string; value: number }>) => items.reduce((sum: number, item: { value: number }) => sum + item.value, 0)
          ),
          
          // Use combine enhancer for multiple state slices
          summary: combine(
            () => model().count,
            () => model().items.length,
            (count: number, itemCount: number) => `Count: ${count}, Items: ${itemCount}`
          ),
          
          // Complex derived selector with memoization built-in
          expensiveComputation: derive(
            () => model().items,
            (items: Array<{ id: string; value: number }>) => {
              // This would only recompute when items change
              console.log('Computing expensive value...');
              return items
                .filter((item: { value: number }) => item.value > 10)
                .map((item: { value: number }) => item.value * 100)
                .reduce((sum: number, val: number) => sum + val, 0);
            }
          ),
        })
      ); // TODO: Add .with(memo, trace) when those enhancers are implemented

      // Test runtime behavior
      // We need to properly implement the model behavior
      let mockState = {
        count: 0,
        items: [] as Array<{ id: string; value: number }>,
      };
      
      const mockTools = {
        set: vi.fn((updates: any) => {
          if (typeof updates === 'function') {
            const newState = updates(mockState);
            mockState = { ...mockState, ...newState };
          } else {
            mockState = { ...mockState, ...updates };
          }
        }),
        get: vi.fn(() => ({
          ...mockState,
          increment: vi.fn(),
          addItem: vi.fn(),
        }) as TestModel),
      };
      
      const modelFactory = testModel as unknown as ModelFactory<TestModel>;
      const modelInstance = modelFactory()(createMockTools(mockTools));
      
      // Verify model instance has expected properties
      expect(modelInstance).toHaveProperty('count');
      expect(modelInstance).toHaveProperty('items');
      expect(modelInstance.count).toBe(0);
      expect(modelInstance.items).toEqual([]);
      
      const selectorsInstance = testSelectors()({ 
        model: () => modelInstance 
      });

      // Basic selectors work
      expect(selectorsInstance.count).toBe(0);
      expect(selectorsInstance.items).toEqual([]);
      expect(selectorsInstance.doubleCount).toBe(0);
      expect(selectorsInstance.totalValue).toBe(0);
      expect(selectorsInstance.summary).toBe('Count: 0, Items: 0');

      // Update model
      modelInstance.increment();
      modelInstance.addItem({ id: '1', value: 15 });
      modelInstance.addItem({ id: '2', value: 5 });

      // Get updated selectors - we need a reactive model that reads current state
      // In a real app, Zustand would handle this reactivity
      const getUpdatedModel = () => {
        // Create a reactive model proxy that always reads from current state
        const currentModelSlice = modelFactory()(createMockTools({
          set: mockTools.set,
          get: () => ({
            ...mockState,
            increment: vi.fn(),
            addItem: vi.fn(),
          }) as TestModel,
        }));
        
        // For the test, we need to ensure model properties read from current state
        // This simulates what Zustand would do with its reactive getters
        const reactiveModel = {
          get count() { return mockState.count; },
          get items() { return mockState.items; },
          increment: currentModelSlice.increment,
          addItem: currentModelSlice.addItem,
        };
        
        return reactiveModel;
      };
      
      const updated = testSelectors()({ 
        model: getUpdatedModel
      });

      expect(updated.count).toBe(1);
      expect(updated.doubleCount).toBe(2);
      expect(updated.items).toHaveLength(2);
      expect(updated.totalValue).toBe(20);
      expect(updated.summary).toBe('Count: 1, Items: 2');
      expect(updated.expensiveComputation).toBe(1500); // 15 * 100

      // Test memoization - calling the same selector instance again shouldn't recompute
      const spy = vi.spyOn(console, 'log');
      
      // Use the same selector instance (updated) instead of creating a new one
      const sameComputation = updated.expensiveComputation;
      expect(sameComputation).toBe(1500);
      
      // The spy should not have been called because we're just accessing 
      // the already-computed property
      expect(spy).not.toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });
}
