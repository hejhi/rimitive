import {
  ACTIONS_TOOLS_BRAND,
  ACTIONS_FACTORY_BRAND,
  ActionsFactoryParams,
  ActionsSliceFactory,
  ActionsFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import { createModel } from '../model';
import type { Enhancer, WithEnhancers, CombineEnhancerTools } from '../shared/enhancers';
import { attachEnhancers, getEnhancers } from '../shared/enhancers';
import type { EnhancedModelFactory } from '../model/create';

/**
 * Enhanced actions factory that includes .with() method
 */
export type EnhancedActionsFactory<T, TModel, TEnhancers extends ReadonlyArray<Enhancer> = []> = 
  ActionsFactory<T, TModel> & WithEnhancers<ActionsFactory<T, TModel>, TEnhancers>;

/**
 * Creates an actions factory.
 *
 * This is the primary API for creating actions in Lattice. Use it to define your
 * actions that delegate to model methods.
 *
 * Supports two APIs:
 * 1. Legacy: createActions({ model }, factory)
 * 2. New: createActions(model, factory) with enhancer support
 *
 * @example
 * ```typescript
 * // Legacy API
 * const counterActions = createActions({ model: counterModel }, ({ model }) => ({
 *   increment: model().increment,
 *   decrement: model().decrement,
 *   reset: model().reset
 * }));
 * 
 * // New API with enhancers
 * const enhancedActions = createActions(counterModel, ({ model }, { derive }) => ({
 *   increment: model().increment,
 *   decrement: model().decrement,
 *   derivedAction: derive(() => model().count, (count) => count > 10 ? 'high' : 'low')
 * }));
 * ```
 */
// Legacy API overload
export function createActions<TActions, TModel = any>(
  params: { model: TModel },
  factory: ActionsSliceFactory<TActions, TModel>
): ActionsFactory<TActions, TModel>;
// New API overload with enhancer support
export function createActions<TActions, TModel = any, TModelEnhancers extends ReadonlyArray<Enhancer> = []>(
  model: EnhancedModelFactory<TModel, TModelEnhancers>,
  factory: (
    params: ActionsFactoryParams<TModel>,
    enhancers: CombineEnhancerTools<TModelEnhancers>
  ) => TActions
): EnhancedActionsFactory<TActions, TModel, []>;
export function createActions<TActions, TModel = any>(
  paramsOrModel: { model: any } | EnhancedModelFactory<TModel, any>,
  factory: any
): any {
  // Check if using new API (model directly) or legacy API ({ model })
  // New API: paramsOrModel is a function (model factory)
  // Legacy API: paramsOrModel is an object with a model property
  const isNewApi = typeof paramsOrModel === 'function';
  const modelEnhancers = isNewApi ? getEnhancers(paramsOrModel) : [];
  
  if (isNewApi) {
    // New API: createActions(model, factory)
    const enhancers = modelEnhancers;
    
    const baseFactory = brandWithSymbol(function actionsFactory<
      S extends Partial<TActions> = TActions,
    >(selector?: (base: TActions) => S) {
      return (options: ActionsFactoryParams<TModel>) => {
        if (!options.model) {
          throw new Error('Actions factory requires a model function');
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
          brandWithSymbol(options, ACTIONS_TOOLS_BRAND),
          enhancerTools
        );

        if (selector) return selector(result);
        return result as unknown as S;
      };
    }, ACTIONS_FACTORY_BRAND);

    // Add enhancers support using the functional approach
    // Use attachEnhancers to properly handle the .with() method
    return attachEnhancers(baseFactory, [] as []);
  } else {
    // Legacy API: createActions({ model }, factory)
    return brandWithSymbol(function actionsFactory<
      S extends Partial<TActions> = TActions,
    >(selector?: (base: TActions) => S) {
      return (options: ActionsFactoryParams<TModel>) => {
        if (!options.model) {
          throw new Error('Actions factory requires a model function');
        }

        const result = factory(brandWithSymbol(options, ACTIONS_TOOLS_BRAND));

        if (selector) return selector(result);
        return result as unknown as S;
      };
    }, ACTIONS_FACTORY_BRAND);
  }
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createActions', async () => {
    const { isActionsFactory } = await import('../shared/identify');

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

      // Create mock model function for factory invocation
      const mockModelFn = vi.fn().mockImplementation(() => ({
        testMethod: vi.fn(),
      }));

      // Create a slice with the mock model function
      const sliceCreator = actions();
      sliceCreator({ model: mockModelFn });

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Function),
        })
      );

      // The tools should be properly structured
      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(toolsObj).toHaveProperty('model');
      expect(typeof toolsObj.model).toBe('function');
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

    it('should support new API with enhancers', async () => {
      const { createModel } = await import('../model/create');
      const { derive, combine } = await import('../shared/enhancers/index');
      
      // Define model type
      type TestModel = {
        count: number;
        status: 'idle' | 'loading' | 'success' | 'error';
        message: string;
        increment: () => void;
        decrement: () => void;
        setStatus: (status: TestModel['status']) => void;
        setMessage: (message: string) => void;
        reset: () => void;
      };
      
      // Create model with enhancers
      const testModel = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        status: 'idle' as TestModel['status'],
        message: '',
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        setStatus: (status: TestModel['status']) => set({ status }),
        setMessage: (message: string) => set({ message }),
        reset: () => set({ count: 0, status: 'idle', message: '' }),
      })).with(derive, combine);

      // Verify model has enhancers
      const modelEnhancers = getEnhancers(testModel);
      expect(modelEnhancers).toHaveLength(2);
      expect(modelEnhancers[0]).toBe(derive);
      expect(modelEnhancers[1]).toBe(combine);

      // Create actions using the new API with enhancers
      const testActions = createActions(testModel as any, 
        ({ model }: { model: () => TestModel }, { derive, combine }: any) => ({
          // Direct delegation to model methods
          increment: model().increment,
          decrement: model().decrement,
          setStatus: model().setStatus,
          
          // Enhanced action using derive - creates a computed action
          toggleCount: derive(
            () => model().count,
            (count: number) => {
              if (count > 0) {
                return model().decrement;
              } else {
                return model().increment;
              }
            }
          ),
          
          // Enhanced action using combine - combines multiple state for logic
          updateWithStatus: combine(
            () => model().status,
            () => model().count,
            (status: TestModel['status'], count: number) => {
              return (newStatus: TestModel['status'], message: string) => {
                model().setStatus(newStatus);
                model().setMessage(`[${status}→${newStatus}] ${message} (count: ${count})`);
              };
            }
          ),
          
          // Complex enhanced action that uses derive to conditionally reset
          smartReset: derive(
            () => ({
              status: model().status,
              count: model().count,
              message: model().message,
            }),
            ({ status, count, message }: { status: TestModel['status']; count: number; message: string }) => {
              return () => {
                // Only reset if status is error or count is negative
                if (status === 'error' || count < 0) {
                  model().reset();
                  model().setMessage(`Reset from ${status} state with count ${count}. Previous: ${message}`);
                } else {
                  model().setMessage(`No reset needed. Status: ${status}, Count: ${count}`);
                }
              };
            }
          ),
        })
      );

      // Test runtime behavior
      let mockState = {
        count: 0,
        status: 'idle' as TestModel['status'],
        message: '',
      };
      
      // Mock tools setup (not directly used but needed for model setup)
      // @ts-ignore - Used implicitly for reactive model setup
      const _mockTools = {
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
          increment: vi.fn(() => mockState.count++),
          decrement: vi.fn(() => mockState.count--),
          setStatus: vi.fn((status: TestModel['status']) => { mockState.status = status; }),
          setMessage: vi.fn((message: string) => { mockState.message = message; }),
          reset: vi.fn(() => {
            mockState = { count: 0, status: 'idle' as TestModel['status'], message: '' };
          }),
        }) as TestModel),
      };
      
      // Create reactive model getter for testing
      const getReactiveModel = () => {
        return {
          get count() { return mockState.count; },
          get status() { return mockState.status; },
          get message() { return mockState.message; },
          increment: () => { mockState.count++; },
          decrement: () => { mockState.count--; },
          setStatus: (status: TestModel['status']) => { mockState.status = status; },
          setMessage: (message: string) => { mockState.message = message; },
          reset: () => {
            mockState = { count: 0, status: 'idle' as TestModel['status'], message: '' };
          },
        };
      };
      
      const actionsInstance = testActions()({ 
        model: getReactiveModel
      });

      // Test basic delegation
      expect(typeof actionsInstance.increment).toBe('function');
      expect(typeof actionsInstance.decrement).toBe('function');
      
      actionsInstance.increment();
      expect(mockState.count).toBe(1);
      
      actionsInstance.decrement();
      expect(mockState.count).toBe(0);

      // Test derived action - toggleCount
      const toggle1 = actionsInstance.toggleCount;
      expect(typeof toggle1).toBe('function');
      
      // When count is 0, should increment
      toggle1();
      expect(mockState.count).toBe(1);
      
      // Get fresh instance to test derive reactivity
      const actionsInstance2 = testActions()({ 
        model: getReactiveModel
      });
      
      // When count is 1, should decrement
      const toggle2 = actionsInstance2.toggleCount;
      toggle2();
      expect(mockState.count).toBe(0);

      // Test combined action - updateWithStatus
      mockState.status = 'idle';
      mockState.count = 5;
      
      const actionsInstance3 = testActions()({ 
        model: getReactiveModel
      });
      
      const updateFn = actionsInstance3.updateWithStatus;
      updateFn('loading', 'Fetching data');
      
      expect(mockState.status).toBe('loading');
      expect(mockState.message).toBe('[idle→loading] Fetching data (count: 5)');

      // Test complex enhanced action - smartReset
      mockState.status = 'error';
      mockState.count = -3;
      mockState.message = 'Something failed';
      
      const actionsInstance4 = testActions()({ 
        model: getReactiveModel
      });
      
      const smartReset = actionsInstance4.smartReset;
      smartReset();
      
      expect(mockState.count).toBe(0);
      expect(mockState.status).toBe('idle');
      expect(mockState.message).toContain('Reset from error state with count -3');

      // Test smartReset when reset is not needed
      mockState.status = 'success';
      mockState.count = 10;
      
      const actionsInstance5 = testActions()({ 
        model: getReactiveModel
      });
      
      const smartReset2 = actionsInstance5.smartReset;
      smartReset2();
      
      expect(mockState.count).toBe(10); // Should not reset
      expect(mockState.status).toBe('success'); // Should not change
      expect(mockState.message).toContain('No reset needed');
    });
  });
}
