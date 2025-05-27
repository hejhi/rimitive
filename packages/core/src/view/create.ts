import {
  VIEW_TOOLS_BRAND,
  VIEW_FACTORY_BRAND,
  ViewSliceFactory,
  ViewFactoryParams,
  ViewFactory,
  SelectorsFactory,
  ActionsFactory,
} from '../shared/types';
import { brandWithSymbol } from '../shared/identify';
import type { Enhancer, WithEnhancers, CombineEnhancerTools } from '../shared/enhancers';
import { attachEnhancers, ENHANCERS_SYMBOL } from '../shared/enhancers';
import type { EnhancedSelectorsFactory } from '../selectors/create';
import type { EnhancedActionsFactory } from '../actions/create';

/**
 * Enhanced view factory that includes .with() method
 */
export type EnhancedViewFactory<T, TSelectors, TActions, TEnhancers extends ReadonlyArray<Enhancer> = []> = 
  ViewFactory<T, TSelectors, TActions> & WithEnhancers<ViewFactory<T, TSelectors, TActions>, TEnhancers>;

/**
 * Creates a view factory.
 *
 * This is the primary API for creating views in Lattice. Use it to define your
 * view's projections and values from selectors and actions. For composition, use the fluent compose API.
 *
 * Supports two APIs:
 * 1. Legacy: createView({ selectors, actions }, factory)
 * 2. New: createView(selectors, actions, factory) with enhancer support
 *
 * @example
 * ```typescript
 * // Legacy API
 * const counterView = createView({ selectors: counterSelectors, actions: counterActions }, ({ selectors, actions }) => ({
 *   'data-count': selectors().count,
 *   onClick: actions().increment
 * }));
 * 
 * // New API with enhancers
 * const enhancedView = createView(counterSelectors, counterActions, ({ selectors, actions }, { derive }) => ({
 *   'data-count': selectors().count,
 *   'aria-label': derive(() => selectors().count, (count) => `Count is ${count}`),
 *   onClick: actions().increment
 * }));
 * ```
 */
// Legacy API overload
export function createView<T, TSelectors = unknown, TActions = unknown>(
  params: { selectors?: TSelectors; actions?: TActions },
  factory: ViewSliceFactory<T, TSelectors, TActions>
): ViewFactory<T, TSelectors, TActions>;
// New API overload with enhancer support
export function createView<
  T, 
  TSelectors = any, 
  TActions = any,
  TSelectorEnhancers extends ReadonlyArray<Enhancer> = [],
  TActionEnhancers extends ReadonlyArray<Enhancer> = []
>(
  selectors: EnhancedSelectorsFactory<TSelectors, any, TSelectorEnhancers> | SelectorsFactory<TSelectors, any>,
  actions: EnhancedActionsFactory<TActions, any, TActionEnhancers> | ActionsFactory<TActions, any>,
  factory: (
    params: ViewFactoryParams<TSelectors, TActions>,
    enhancers: CombineEnhancerTools<TSelectorEnhancers> & CombineEnhancerTools<TActionEnhancers>
  ) => T
): EnhancedViewFactory<T, TSelectors, TActions, []>;
export function createView<T, TSelectors = unknown, TActions = unknown>(
  // @ts-ignore - Used to detect API style via arguments.length
  paramsOrSelectors: { selectors?: any; actions?: any } | any,
  factoryOrActions?: any,
  factoryIfNewApi?: any
): any {
  // Check if using new API or legacy API
  // New API: createView(selectors, actions, factory)
  // Legacy API: createView({ selectors, actions }, factory)
  const isNewApi = arguments.length === 3;
  
  if (isNewApi) {
    // New API: createView(selectors, actions, factory)
    // We don't need to extract enhancers from selectors/actions
    // as they will be added via .with() on the view factory
    const factory = factoryIfNewApi;
    
    // Create a factory that will be enhanced later
    const createEnhancedFactory = (enhancers: ReadonlyArray<Enhancer>) => {
      return brandWithSymbol(function viewFactory<S extends Partial<T> = T>(
        selector?: (base: T) => S
      ) {
        return (options: ViewFactoryParams<TSelectors, TActions>) => {
          // Ensure the required properties exist
          if (!options.selectors || !options.actions) {
            throw new Error(
              'View factory requires selectors and actions functions'
            );
          }

          // Create enhancer tools from enhancers
          const enhancerTools: any = {};
          if (Array.isArray(enhancers)) {
            enhancers.forEach((enhancer: Enhancer) => {
              if (enhancer && enhancer.name && enhancer.create) {
                // For views, enhancers get access to both selectors and actions
                const context = {
                  getState: () => ({
                    selectors: options.selectors(),
                    actions: options.actions()
                  }),
                };
                enhancerTools[enhancer.name] = enhancer.create(context);
              }
            });
          }

          // Call factory with both params and enhancer tools
          const result = factory(
            brandWithSymbol(options, VIEW_TOOLS_BRAND),
            enhancerTools
          );

          // If a selector is provided, apply it to filter properties
          if (selector) return selector(result);

          // Otherwise return the full result
          return result as unknown as S;
        };
      }, VIEW_FACTORY_BRAND);
    };

    // Start with no enhancers and use attachEnhancers which will recreate the factory when .with() is called
    const baseFactory = createEnhancedFactory([]);
    
    // Override attachEnhancers behavior to recreate the factory with new enhancers
    const enhancedFactory = Object.assign(baseFactory, {
      with<E extends Enhancer[]>(...newEnhancers: E): any {
        return attachEnhancers(createEnhancedFactory(newEnhancers), newEnhancers as any);
      },
      [ENHANCERS_SYMBOL]: () => [] as Enhancer[],
    });
    
    return enhancedFactory;
  } else {
    // Legacy API: createView({ selectors, actions }, factory)
    const factory = factoryOrActions;
    
    return brandWithSymbol(function viewFactory<S extends Partial<T> = T>(
      selector?: (base: T) => S
    ) {
      return (options: ViewFactoryParams<TSelectors, TActions>) => {
        // Ensure the required properties exist
        if (!options.selectors || !options.actions) {
          throw new Error(
            'View factory requires selectors and actions functions'
          );
        }

        // Call the factory with object parameters to match the spec
        const result = factory(brandWithSymbol(options, VIEW_TOOLS_BRAND));

        // If a selector is provided, apply it to filter properties
        if (selector) return selector(result);

        // Otherwise return the full result
        return result as unknown as S;
      };
    }, VIEW_FACTORY_BRAND);
  }
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi, describe } = import.meta.vitest;

  describe('createView', async () => {
    const { isViewFactory } = await import('../shared/identify');
    const { createMockTools, mockImplementations } = await import('../test-utils');

    it('should verify view factory requirements and branding', () => {
      // Use standardized mock implementations
      const mockSelectors = {
        count: 42,
        isPositive: true,
      };

      const mockActions = mockImplementations.counterActions();

      // Create a spy factory with object parameters
      const factorySpy = vi.fn(
        ({
          selectors,
          actions,
        }: ViewFactoryParams<typeof mockSelectors, typeof mockActions>) => ({
          'data-count': selectors().count,
          'aria-positive': selectors().isPositive,
          onClick: actions().increment,
          onReset: actions().reset,
        })
      );

      const view = createView(
        { selectors: mockSelectors, actions: mockActions },
        factorySpy
      );

      // View should be a function
      expect(typeof view).toBe('function');

      expect(isViewFactory(view)).toBe(true);

      // Use standardized mock tools
      const mockTools = createMockTools({
        selectors: () => mockSelectors,
        actions: () => mockActions,
      });

      // Create a slice with the proper params
      const sliceCreator = view();
      const slice = sliceCreator(mockTools);

      // Factory should be called with object parameters
      expect(factorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectors: expect.any(Function),
          actions: expect.any(Function),
        })
      );

      const toolsObj = factorySpy.mock.calls[0]?.[0];
      expect(toolsObj).toBeDefined();
      expect(toolsObj).toHaveProperty('selectors');
      expect(toolsObj).toHaveProperty('actions');
      expect(typeof toolsObj!.selectors).toBe('function');
      expect(typeof toolsObj!.actions).toBe('function');

      // Verify slice contains the expected values
      expect(slice).toEqual({
        'data-count': 42,
        'aria-positive': true,
        onClick: mockActions.increment,
        onReset: mockActions.reset,
      });

      // Ensure selectors and actions functions return the correct values
      expect(factorySpy.mock.calls[0]?.[0].selectors()).toBe(mockSelectors);
      expect(factorySpy.mock.calls[0]?.[0].actions()).toBe(mockActions);
    });

    it('should support new API with enhancers', async () => {
      const { createModel } = await import('../model/create');
      const { createSelectors } = await import('../selectors/create');
      const { createActions } = await import('../actions/create');
      const { derive, combine } = await import('../shared/enhancers/index');
      
      // Define model type
      type TestModel = {
        count: number;
        isEnabled: boolean;
        theme: 'light' | 'dark';
        items: string[];
        increment: () => void;
        toggleEnabled: () => void;
        toggleTheme: () => void;
        addItem: (item: string) => void;
      };
      
      // Create model with enhancers
      const testModel = createModel<TestModel>(({ set, get }) => ({
        count: 0,
        isEnabled: true,
        theme: 'light' as TestModel['theme'],
        items: [],
        increment: () => set({ count: get().count + 1 }),
        toggleEnabled: () => set({ isEnabled: !get().isEnabled }),
        toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
        addItem: (item: string) => set({ items: [...get().items, item] }),
      })).with(derive, combine);

      // Create selectors with enhancers
      const testSelectors = createSelectors(testModel as any, 
        ({ model }: { model: () => TestModel }, { derive, combine }: any) => ({
          count: model().count,
          isEnabled: model().isEnabled,
          theme: model().theme,
          items: model().items,
          
          // Derived values
          doubleCount: derive(
            () => model().count,
            (count: number) => count * 2
          ),
          
          status: combine(
            () => model().isEnabled,
            () => model().count,
            (enabled: boolean, count: number) => enabled ? `Active: ${count}` : 'Disabled'
          ),
        })
      );

      // Create actions with enhancers
      const testActions = createActions(testModel as any, 
        ({ model }: { model: () => TestModel }, { derive }: any) => ({
          increment: model().increment,
          toggleEnabled: model().toggleEnabled,
          toggleTheme: model().toggleTheme,
          
          // Smart increment that checks if enabled
          smartIncrement: derive(
            () => model().isEnabled,
            (isEnabled: boolean) => {
              return () => {
                if (isEnabled) {
                  model().increment();
                }
              };
            }
          ),
        })
      );

      // Create view using the new API and add enhancers
      const testView = createView(testSelectors as any, testActions as any,
        ({ selectors, actions }: ViewFactoryParams<any, any>, enhancers: any) => {
          const { derive, combine } = enhancers;
          return {
          // Basic attributes
          'data-count': selectors().count,
          'data-theme': selectors().theme,
          'aria-disabled': !selectors().isEnabled,
          
          // Event handlers
          onClick: actions().smartIncrement,
          onToggle: actions().toggleEnabled,
          
          // Enhanced attributes using derive
          'aria-label': derive(
            () => selectors().count,
            (count: number) => `Current count is ${count}`
          ),
          
          'data-status': derive(
            () => selectors().status,
            (status: string) => status.toLowerCase().replace(/\s+/g, '-')
          ),
          
          // Enhanced attributes using combine
          className: combine(
            () => selectors().theme,
            () => selectors().isEnabled,
            () => selectors().count,
            (theme: 'light' | 'dark', enabled: boolean, count: number) => {
              const classes = [`theme-${theme}`];
              if (!enabled) classes.push('disabled');
              if (count > 10) classes.push('high-count');
              return classes.join(' ');
            }
          ),
          
          title: combine(
            () => selectors().status,
            () => selectors().theme,
            (status: string, theme: 'light' | 'dark') => `${status} (${theme} theme)`
          ),
        };}
      ).with(derive, combine);

      // Test runtime behavior
      let mockState = {
        count: 0,
        isEnabled: true,
        theme: 'light' as TestModel['theme'],
        items: [] as string[],
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
          increment: () => { mockState.count++; },
          toggleEnabled: () => { mockState.isEnabled = !mockState.isEnabled; },
          toggleTheme: () => { mockState.theme = mockState.theme === 'light' ? 'dark' : 'light'; },
          addItem: (item: string) => { mockState.items = [...mockState.items, item]; },
        }) as TestModel),
      };
      
      // Create reactive getters
      const getReactiveModel = () => ({
        get count() { return mockState.count; },
        get isEnabled() { return mockState.isEnabled; },
        get theme() { return mockState.theme; },
        get items() { return mockState.items; },
        increment: () => { mockState.count++; },
        toggleEnabled: () => { mockState.isEnabled = !mockState.isEnabled; },
        toggleTheme: () => { mockState.theme = mockState.theme === 'light' ? 'dark' : 'light'; },
        addItem: (item: string) => { mockState.items = [...mockState.items, item]; },
      });
      
      const getReactiveSelectors = () => {
        const model = getReactiveModel();
        return {
          count: model.count,
          isEnabled: model.isEnabled,
          theme: model.theme,
          items: model.items,
          doubleCount: model.count * 2,
          status: model.isEnabled ? `Active: ${model.count}` : 'Disabled',
        };
      };
      
      const getReactiveActions = () => {
        const model = getReactiveModel();
        return {
          increment: model.increment,
          toggleEnabled: model.toggleEnabled,
          toggleTheme: model.toggleTheme,
          smartIncrement: () => {
            if (model.isEnabled) {
              model.increment();
            }
          },
        };
      };
      
      // Get view instance
      const viewInstance = testView()({
        selectors: getReactiveSelectors,
        actions: getReactiveActions,
      });

      // Test basic attributes
      expect(viewInstance['data-count']).toBe(0);
      expect(viewInstance['data-theme']).toBe('light');
      expect(viewInstance['aria-disabled']).toBe(false);
      
      // Test enhanced attributes
      expect(viewInstance['aria-label']).toBe('Current count is 0');
      expect(viewInstance['data-status']).toBe('active:-0');
      expect(viewInstance.className).toBe('theme-light');
      expect(viewInstance.title).toBe('Active: 0 (light theme)');
      
      // Test event handlers
      expect(typeof viewInstance.onClick).toBe('function');
      expect(typeof viewInstance.onToggle).toBe('function');
      
      // Update state and test reactivity
      viewInstance.onClick(); // Should increment since enabled
      expect(mockState.count).toBe(1);
      
      // Get fresh view instance with updated state
      const viewInstance2 = testView()({
        selectors: getReactiveSelectors,
        actions: getReactiveActions,
      });
      
      expect(viewInstance2['data-count']).toBe(1);
      expect(viewInstance2['aria-label']).toBe('Current count is 1');
      expect(viewInstance2['data-status']).toBe('active:-1');
      expect(viewInstance2.title).toBe('Active: 1 (light theme)');
      
      // Disable and test smart increment
      viewInstance2.onToggle();
      expect(mockState.isEnabled).toBe(false);
      
      const viewInstance3 = testView()({
        selectors: getReactiveSelectors,
        actions: getReactiveActions,
      });
      
      expect(viewInstance3['aria-disabled']).toBe(true);
      expect(viewInstance3['data-status']).toBe('disabled');
      expect(viewInstance3.className).toBe('theme-light disabled');
      expect(viewInstance3.title).toBe('Disabled (light theme)');
      
      // Smart increment should not work when disabled
      const countBefore = mockState.count;
      viewInstance3.onClick();
      expect(mockState.count).toBe(countBefore);
      
      // Toggle theme and test
      viewInstance3.onToggle(); // Re-enable
      mockState.theme = 'dark';
      mockState.count = 15; // High count
      
      const viewInstance4 = testView()({
        selectors: getReactiveSelectors,
        actions: getReactiveActions,
      });
      
      expect(viewInstance4['data-theme']).toBe('dark');
      expect(viewInstance4.className).toBe('theme-dark high-count');
      expect(viewInstance4['aria-label']).toBe('Current count is 15');
      expect(viewInstance4.title).toBe('Active: 15 (dark theme)');
    });
  });
}
