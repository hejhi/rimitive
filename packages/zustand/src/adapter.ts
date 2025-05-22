import type { ComponentFactory, LatticeAPI, SetState, GetState } from '@lattice/core';
import { createStore } from 'zustand/vanilla';

/**
 * Zustand store state structure containing model, selectors, and actions
 */
type ZustandStoreState<TModel, TSelectors, TActions> = {
  model: TModel;
  selectors: TSelectors;
  actions: TActions;
};

/**
 * Create a Zustand store adapter that consumes Lattice component factories
 */
export function createZustandAdapter<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>,
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>
): LatticeAPI<TSelectors, TActions, TViews> {
  // Consume the component factory to get the Lattice instance with slice factories
  const lattice = componentFactory();

  // Extract the slice factories
  const modelFactory = lattice.getModel();
  const selectorsFactory = lattice.getSelectors();
  const actionsFactory = lattice.getActions();
  const viewFactories = lattice.getAllViews();

  // Create Zustand store and execute slice factories with runtime tools
  const store = createStore<ZustandStoreState<TModel, TSelectors, TActions>>(
    (set, get) => {
      // Create model-specific set/get that only operate on the model slice
      const modelSet: SetState<TModel> = (partial) => {
        if (typeof partial === 'function') {
          set((state) => {
            const updater = partial as (state: TModel) => TModel | Partial<TModel>;
            const newModel = updater(state.model);
            return { ...state, model: { ...state.model, ...newModel } };
          });
        } else {
          set((state) => ({ ...state, model: { ...state.model, ...partial } }));
        }
      };
      const modelGet: GetState<TModel> = () => get().model;

      // Execute model factory with model-scoped set/get tools
      const model = modelFactory()({ set: modelSet, get: modelGet });

      // Execute selectors factory with model access
      // During store initialization, we need to use the model we just created
      const selectors = selectorsFactory()({ model: () => model });

      // Execute actions factory with model access
      const actions = actionsFactory()({ model: () => model });

      return { model, selectors, actions };
    }
  );

  // Track active subscriptions for cleanup
  const subscriptions = new Set<() => void>();

  // Return standardized Lattice API
  return {
    getSelectors: () => store.getState().selectors,
    getActions: () => store.getState().actions,
    subscribe: (callback) => {
      // Zustand's subscribe returns an unsubscribe function directly
      const unsubscribe = store.subscribe(callback);
      subscriptions.add(unsubscribe);

      // Return unsubscribe that also removes from tracking
      return () => {
        unsubscribe();
        subscriptions.delete(unsubscribe);
      };
    },
    getViews: () => viewFactories as TViews,
    destroy: () => {
      // Clean up all active subscriptions
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
      // Note: Zustand stores don't need explicit cleanup beyond unsubscribing
    },
  };
}

if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('createZustandAdapter', () => {
    it('should consume a component factory and extract slice factories', () => {
      // Arrange
      const mockModel = { count: 0, increment: vi.fn() };
      const mockSelectors = { count: 0, isEven: vi.fn() };
      const mockActions = { increment: vi.fn() };

      const mockModelSliceFactory = vi.fn(() => mockModel);
      const mockSelectorsSliceFactory = vi.fn(() => mockSelectors);
      const mockActionsSliceFactory = vi.fn(() => mockActions);

      const mockModelFactory = vi.fn(() => mockModelSliceFactory);
      const mockSelectorsFactory = vi.fn(() => mockSelectorsSliceFactory);
      const mockActionsFactory = vi.fn(() => mockActionsSliceFactory);
      const mockViewFactory = vi.fn();

      const mockLattice = {
        getModel: vi.fn(() => mockModelFactory),
        getSelectors: vi.fn(() => mockSelectorsFactory),
        getActions: vi.fn(() => mockActionsFactory),
        getView: vi.fn(() => mockViewFactory),
        getAllViews: vi.fn(() => ({ button: mockViewFactory })),
      };

      const mockComponentFactory = vi.fn(() => mockLattice) as any;

      // Act
      createZustandAdapter(mockComponentFactory);

      // Assert
      expect(mockComponentFactory).toHaveBeenCalledOnce();
      expect(mockLattice.getModel).toHaveBeenCalledOnce();
      expect(mockLattice.getSelectors).toHaveBeenCalledOnce();
      expect(mockLattice.getActions).toHaveBeenCalledOnce();
      expect(mockLattice.getAllViews).toHaveBeenCalledOnce();

      // Verify factories were called with appropriate parameters
      expect(mockModelSliceFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.any(Function),
          get: expect.any(Function),
        })
      );
      expect(mockSelectorsSliceFactory).toHaveBeenCalledWith(
        expect.objectContaining({ model: expect.any(Function) })
      );
      expect(mockActionsSliceFactory).toHaveBeenCalledWith(
        expect.objectContaining({ model: expect.any(Function) })
      );
    });
    
    it('should return a working LatticeAPI with getSelectors, getActions, subscribe, and destroy', () => {
      // Arrange
      const mockModel = { count: 0, increment: vi.fn() };
      const mockSelectors = { count: 0, isEven: () => mockModel.count % 2 === 0 };
      const mockActions = { increment: vi.fn() };
      const mockViews = { button: vi.fn() };
      
      const mockModelSliceFactory = vi.fn(() => mockModel);
      const mockSelectorsSliceFactory = vi.fn(() => mockSelectors);
      const mockActionsSliceFactory = vi.fn(() => mockActions);
      
      const mockModelFactory = vi.fn(() => mockModelSliceFactory);
      const mockSelectorsFactory = vi.fn(() => mockSelectorsSliceFactory);
      const mockActionsFactory = vi.fn(() => mockActionsSliceFactory);
      
      const mockLattice = {
        getModel: vi.fn(() => mockModelFactory),
        getSelectors: vi.fn(() => mockSelectorsFactory),
        getActions: vi.fn(() => mockActionsFactory),
        getView: vi.fn(),
        getAllViews: vi.fn(() => mockViews),
      };
      
      const mockComponentFactory = vi.fn(() => mockLattice) as any;

      // Act
      const api = createZustandAdapter(mockComponentFactory);

      // Assert LatticeAPI methods exist and work
      expect(api.getSelectors).toBeDefined();
      expect(api.getActions).toBeDefined();
      expect(api.subscribe).toBeDefined();
      expect(api.getViews).toBeDefined();
      expect(api.destroy).toBeDefined();
      
      // Test getSelectors returns the selectors
      const selectors = api.getSelectors();
      expect(selectors).toBe(mockSelectors);
      
      // Test getActions returns the actions
      const actions = api.getActions();
      expect(actions).toBe(mockActions);
      
      // Test getViews returns the views
      const views = api.getViews();
      expect(views).toBe(mockViews);
      
      // Test subscribe and unsubscribe
      const callback = vi.fn();
      const unsubscribe = api.subscribe(callback);
      expect(unsubscribe).toBeInstanceOf(Function);
      
      // Cleanup
      unsubscribe();
      api.destroy();
    });
  });
}
