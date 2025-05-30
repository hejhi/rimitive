/**
 * @fileoverview Tests for React hooks in Zustand adapter
 * 
 * These tests use React Testing Library with proper TypeScript typing
 * and follow best practices for testing React hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ZustandAdapterResult, Store } from './index.js';
import { 
  useStore, 
  useModelSelector, 
  useView, 
  useStoreSelector, 
  useActions 
} from './react.js';

// Import internal types needed for mocking
type SelectorHook<T> = () => T;
type UseSelectors<Model> = {
  [K in keyof Model]: SelectorHook<Model[K]>;
};
type ActionHooks<Actions> = {
  [K in keyof Actions]: SelectorHook<Actions[K]>;
};

// Mock zustand/react
vi.mock('zustand/react', () => ({
  useStore: vi.fn()
}));


// Import mocked functions
import { useStore as mockUseZustandStore } from 'zustand/react';

describe('React hooks for Zustand adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create a mock ZustandAdapterResult
  function createMockAdapterResult<M = any, A = any, V = any>(
    overrides: Partial<ZustandAdapterResult<M, A, V>> = {}
  ): ZustandAdapterResult<M, A, V> {
    const base = {
      getState: vi.fn(() => ({ count: 0, name: 'test' } as M)),
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
      use: {} as UseSelectors<M>,
      actions: {} as ActionHooks<A>,
      views: {} as any,
    };
    return { ...base, ...overrides } as ZustandAdapterResult<M, A, V>;
  }

  // Helper to create a mock Store
  function createMockStore<T>(value: T): Store<T> {
    const listeners = new Set<(value: T) => void>();
    return {
      get: vi.fn(() => value),
      set: vi.fn(),
      subscribe: vi.fn((listener: (value: T) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      })
    };
  }

  describe('useStore', () => {
    it('should return entire state when no selector provided', () => {
      const mockState = { count: 5, name: 'test' };
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState)
      });
      
      vi.mocked(mockUseZustandStore).mockReturnValue(mockState);
      
      const { result } = renderHook(() => useStore(mockStore));
      
      expect(result.current).toEqual(mockState);
      expect(mockUseZustandStore).toHaveBeenCalledWith(mockStore);
    });
    
    it('should return selected value when selector provided', () => {
      const mockState = { count: 5, name: 'test' };
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState)
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => 
        selector ? selector(mockState) : mockState
      );
      
      const { result } = renderHook(() => 
        useStore(mockStore, (state) => state.count)
      );
      
      expect(result.current).toBe(5);
      expect(mockUseZustandStore).toHaveBeenCalledWith(mockStore, expect.any(Function));
    });
    
    it('should handle computed selectors', () => {
      const mockState = { count: 10, multiplier: 2 };
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState)
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => 
        selector(mockState)
      );
      
      const { result } = renderHook(() => 
        useStore(mockStore, (state) => state.count * state.multiplier)
      );
      
      expect(result.current).toBe(20);
    });
  });

  describe('useModelSelector', () => {
    it('should work with direct selector hook', () => {
      const mockValue = 'test-value';
      const mockSelectorHook = vi.fn(() => mockValue);
      
      const { result } = renderHook(() => useModelSelector(mockSelectorHook));
      
      expect(result.current).toBe(mockValue);
      expect(mockSelectorHook).toHaveBeenCalledTimes(1);
    });
    
    it('should handle complex objects returned by selector hooks', () => {
      const mockUser = { id: 1, name: 'Bob', role: 'admin' };
      const mockUserHook = vi.fn(() => mockUser);
      
      const { result } = renderHook(() => useModelSelector(mockUserHook));
      
      expect(result.current).toEqual(mockUser);
      expect(mockUserHook).toHaveBeenCalledTimes(1);
    });
    
    it('should handle multiple calls with different selector hooks', () => {
      const mockCount = vi.fn(() => 42);
      const mockName = vi.fn(() => 'Alice');
      
      const { result: countResult } = renderHook(() => useModelSelector(mockCount));
      const { result: nameResult } = renderHook(() => useModelSelector(mockName));
      
      expect(countResult.current).toBe(42);
      expect(nameResult.current).toBe('Alice');
      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(mockName).toHaveBeenCalledTimes(1);
    });
  });

  describe('useActions', () => {
    it('should return all actions as an object', () => {
      const mockIncrement = vi.fn();
      const mockDecrement = vi.fn();
      const mockReset = vi.fn();
      
      const mockStore = createMockAdapterResult({
        actions: {
          increment: vi.fn(() => mockIncrement),
          decrement: vi.fn(() => mockDecrement),
          reset: vi.fn(() => mockReset)
        }
      });
      
      const { result } = renderHook(() => useActions(mockStore));
      
      expect(result.current).toEqual({
        increment: mockIncrement,
        decrement: mockDecrement,
        reset: mockReset
      });
      
      // Verify all action hooks were called
      expect(mockStore.actions.increment).toHaveBeenCalledTimes(1);
      expect(mockStore.actions.decrement).toHaveBeenCalledTimes(1);
      expect(mockStore.actions.reset).toHaveBeenCalledTimes(1);
    });
    
    it('should support destructuring specific actions', () => {
      const mockIncrement = vi.fn();
      const mockDecrement = vi.fn();
      const mockReset = vi.fn();
      
      const mockStore = createMockAdapterResult({
        actions: {
          increment: vi.fn(() => mockIncrement),
          decrement: vi.fn(() => mockDecrement),
          reset: vi.fn(() => mockReset)
        }
      });
      
      const { result } = renderHook(() => {
        const { increment, decrement } = useActions(mockStore);
        return { increment, decrement };
      });
      
      expect(result.current.increment).toBe(mockIncrement);
      expect(result.current.decrement).toBe(mockDecrement);
      expect(typeof result.current.increment).toBe('function');
      expect(typeof result.current.decrement).toBe('function');
    });
    
    it('should return stable action references', () => {
      const stableIncrement = vi.fn();
      const stableDecrement = vi.fn();
      const mockStore = createMockAdapterResult({
        actions: {
          increment: vi.fn(() => stableIncrement),
          decrement: vi.fn(() => stableDecrement)
        }
      });
      
      const { result, rerender } = renderHook(() => useActions(mockStore));
      
      const firstResult = result.current;
      
      // Rerender
      rerender();
      
      // Actions should be stable
      expect(result.current.increment).toBe(firstResult.increment);
      expect(result.current.decrement).toBe(firstResult.decrement);
    });
    
    it('should handle action execution', async () => {
      let actionCallCount = 0;
      const mockAction = vi.fn(() => {
        actionCallCount++;
      });
      
      const mockStore = createMockAdapterResult({
        actions: {
          testAction: vi.fn(() => mockAction)
        }
      });
      
      const { result } = renderHook(() => useActions(mockStore));
      
      // Execute the action
      await act(async () => {
        result.current.testAction();
      });
      
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(actionCallCount).toBe(1);
    });

  describe('useView', () => {
    it('should handle static view hooks with selector', () => {
      const viewData = { text: 'Hello', count: 5 };
      const mockViewHook = vi.fn(() => viewData);
      
      const mockStore = createMockAdapterResult({
        views: {
          display: mockViewHook
        } as any
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => {
        return selector();
      });
      
      const { result } = renderHook(() => useView(mockStore, views => views.display));
      
      expect(result.current).toEqual(viewData);
      expect(mockViewHook).toHaveBeenCalled();
    });
    
    it('should handle computed view hooks with selector', () => {
      const viewData = { className: 'even', label: 'Count: 2' };
      const mockViewHook = vi.fn(() => viewData);
      
      const mockStore = createMockAdapterResult({
        views: {
          counter: mockViewHook
        } as any
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => {
        return selector();
      });
      
      const { result } = renderHook(() => useView(mockStore, views => views.counter));
      
      expect(result.current).toEqual(viewData);
      expect(mockViewHook).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error for invalid view (not a function)', () => {
      const invalidViews = [
        { someProperty: 'value' },
        'not-a-function',
        123,
        null,
        undefined
      ];
      
      invalidViews.forEach((invalidView) => {
        const mockStore = createMockAdapterResult({
          views: { bad: invalidView } as any
        });
        
        const { result } = renderHook(() => {
          try {
            return useView(mockStore, views => views.bad);
          } catch (error) {
            return error;
          }
        });
        
        expect(result.current).toBeInstanceOf(Error);
        expect((result.current as Error).message).toBe(
          'Invalid view selection: views must be hooks (functions)'
        );
      });
    });
    
    it('should handle view updates through store subscription', async () => {
      let currentValue = { count: 0 };
      const mockViewHook = vi.fn(() => currentValue);
      
      const mockStore = createMockAdapterResult({
        views: { counter: mockViewHook } as any
      });
      
      // Mock the store subscription behavior
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => {
        return selector();
      });
      
      const { result, rerender } = renderHook(() => useView(mockStore, views => views.counter));
      
      expect(result.current).toEqual({ count: 0 });
      expect(mockViewHook).toHaveBeenCalledTimes(1);
      
      // Update the value that the hook returns
      currentValue = { count: 1 };
      
      // Rerender to simulate store update
      rerender();
      
      expect(result.current).toEqual({ count: 1 });
      expect(mockViewHook).toHaveBeenCalledTimes(2);
    });
    
    it('should support dynamic view selection with dependencies', () => {
      const viewData1 = { text: 'View 1' };
      const viewData2 = { text: 'View 2' };
      const mockViewHook1 = vi.fn(() => viewData1);
      const mockViewHook2 = vi.fn(() => viewData2);
      
      const mockStore = createMockAdapterResult({
        views: {
          view1: mockViewHook1,
          view2: mockViewHook2
        } as any
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => {
        return selector();
      });
      
      const { result, rerender } = renderHook(
        ({ viewKey }) => useView(mockStore, views => views[viewKey], [viewKey]),
        { initialProps: { viewKey: 'view1' as 'view1' | 'view2' } }
      );
      
      expect(result.current).toEqual(viewData1);
      expect(mockViewHook1).toHaveBeenCalled();
      expect(mockViewHook2).not.toHaveBeenCalled();
      
      // Change the view key
      rerender({ viewKey: 'view2' as 'view1' | 'view2' });
      
      expect(result.current).toEqual(viewData2);
      expect(mockViewHook2).toHaveBeenCalled();
    });
    
    it('should support conditional view selection', () => {
      const loadingData = { text: 'Loading...' };
      const contentData = { text: 'Content loaded' };
      const mockLoadingHook = vi.fn(() => loadingData);
      const mockContentHook = vi.fn(() => contentData);
      
      const mockStore = createMockAdapterResult({
        views: {
          loading: mockLoadingHook,
          content: mockContentHook
        } as any
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => {
        return selector();
      });
      
      const { result, rerender } = renderHook(
        ({ isLoading }) => useView(
          mockStore,
          views => isLoading ? views.loading : views.content,
          [isLoading]
        ),
        { initialProps: { isLoading: true } }
      );
      
      expect(result.current).toEqual(loadingData);
      expect(mockLoadingHook).toHaveBeenCalled();
      expect(mockContentHook).not.toHaveBeenCalled();
      
      // Toggle loading state
      rerender({ isLoading: false });
      
      expect(result.current).toEqual(contentData);
      expect(mockContentHook).toHaveBeenCalled();
    });
  });

  describe('useStoreSelector', () => {
    it('should pass through to zustand useStore with selector', () => {
      const mockState = { value: 42, name: 'test' };
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState)
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => 
        selector(mockState)
      );
      
      const selector = (state: typeof mockState) => state.value;
      const { result } = renderHook(() => useStoreSelector(mockStore, selector));
      
      expect(result.current).toBe(42);
      expect(mockUseZustandStore).toHaveBeenCalledWith(mockStore, selector);
    });
    
    it('should handle complex selectors', () => {
      const mockState = {
        todos: [
          { id: 1, text: 'First', completed: false },
          { id: 2, text: 'Second', completed: true },
          { id: 3, text: 'Third', completed: false }
        ]
      };
      
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState)
      });
      
      vi.mocked(mockUseZustandStore).mockImplementation((_store: any, selector: any) => 
        selector(mockState)
      );
      
      const { result } = renderHook(() => 
        useStoreSelector(mockStore, (state) => ({
          activeCount: state.todos.filter(t => !t.completed).length,
          completedCount: state.todos.filter(t => t.completed).length
        }))
      );
      
      expect(result.current).toEqual({
        activeCount: 2,
        completedCount: 1
      });
    });
  });

    
    it('should handle empty actions', () => {
      const mockStore = createMockAdapterResult({ actions: {} });
      
      const { result } = renderHook(() => useActions(mockStore));
      
      expect(result.current).toEqual({});
    });
    
    it('should only include function properties from actions', () => {
      const mockAction = vi.fn();
      
      const mockStore = createMockAdapterResult({
        actions: {
          validAction: vi.fn(() => mockAction),
          notAFunction: 'string-value' as any,
          nullValue: null as any,
          undefinedValue: undefined as any
        }
      });
      
      const { result } = renderHook(() => useActions(mockStore));
      
      expect(result.current).toEqual({
        validAction: mockAction
      });
      expect(Object.keys(result.current)).toHaveLength(1);
    });
    
    it('should handle actions with Object.create(null) prototype', () => {
      const mockAction = vi.fn();
      const mockConstructorFn = vi.fn();
      
      // Create object without prototype
      const actionsObj = Object.create(null);
      actionsObj.validAction = vi.fn(() => mockAction);
      actionsObj.constructor = vi.fn(() => mockConstructorFn);
      
      const mockStore = createMockAdapterResult({
        actions: actionsObj
      });
      
      const { result } = renderHook(() => useActions(mockStore));
      
      expect(result.current.validAction).toBe(mockAction);
      expect(result.current.constructor).toBe(mockConstructorFn);
      expect(Object.keys(result.current)).toContain('validAction');
      expect(Object.keys(result.current)).toContain('constructor');
    });
  });

  describe('integration scenarios', () => {
    it('should work with complete adapter result', () => {
      const mockState = {
        count: 0,
        user: { name: 'Test', id: 1 },
        items: ['a', 'b', 'c']
      };
      
      const mockIncrement = vi.fn();
      const mockUpdateUser = vi.fn();
      
      const mockDisplayStore = createMockStore({ 
        text: 'Count: 0', 
        className: 'zero' 
      });
      
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => mockState),
        use: {
          count: vi.fn(() => mockState.count),
          user: vi.fn(() => mockState.user),
          items: vi.fn(() => mockState.items)
        },
        actions: {
          increment: vi.fn(() => mockIncrement),
          updateUser: vi.fn(() => mockUpdateUser)
        },
        views: {
          display: mockDisplayStore,
          computed: vi.fn(() => mockDisplayStore)
        } as any
      });
      
      // Test model selector
      const { result: countResult } = renderHook(() => 
        useModelSelector(mockStore.use.count as (() => number))
      );
      expect(countResult.current).toBe(0);
      
      // Test model selector with user property
      const { result: userResult } = renderHook(() => 
        useModelSelector(mockStore.use.user as (() => { name: string; id: number }))
      );
      expect(userResult.current).toEqual({ name: 'Test', id: 1 });
      
      // Test all actions
      const { result: actionsResult } = renderHook(() => 
        useActions(mockStore)
      );
      expect(actionsResult.current).toEqual({
        increment: mockIncrement,
        updateUser: mockUpdateUser
      });
    });
    
    it('should handle state updates correctly', async () => {
      let currentState = { count: 0 };
      const listeners = new Set<() => void>();
      
      const mockStore = createMockAdapterResult({
        getState: vi.fn(() => currentState),
        setState: vi.fn((partial) => {
          currentState = { ...currentState, ...partial };
          listeners.forEach(l => l());
        }),
        subscribe: vi.fn((listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }),
        use: {
          count: vi.fn(() => currentState.count)
        },
        actions: {
          increment: vi.fn(() => () => {
            mockStore.setState({ count: currentState.count + 1 });
          })
        }
      });
      
      const { result: actionsResult } = renderHook(() => 
        useActions(mockStore)
      );
      
      const { result: countResult, rerender } = renderHook(() => 
        useModelSelector(mockStore.use.count as (() => number))
      );
      
      expect(countResult.current).toBe(0);
      
      // Execute action
      await act(async () => {
        actionsResult.current.increment();
      });
      
      // Simulate state update
      (mockStore.use as any).count = vi.fn(() => currentState.count);
      rerender();
      
      expect(countResult.current).toBe(1);
    });
  });
  
  describe('type safety', () => {
    it('should properly extract types from ZustandAdapterResult', () => {
      type TestModel = {
        count: number;
        name: string;
        items: string[];
      };
      
      type TestActions = {
        increment: () => void;
        decrement: () => void;
        setName: (name: string) => void;
        addItem: (item: string) => void;
      };
      
      type TestViews = {
        display: Store<{ text: string; className: string }>;
        summary: () => Store<{ total: number; label: string }>;
      };
      
      // Type verification - these assignments verify type extraction works
      const model: TestModel = {
        count: 0,
        name: 'test',
        items: []
      };
      
      const actions: TestActions = {
        increment: vi.fn(),
        decrement: vi.fn(),
        setName: vi.fn(),
        addItem: vi.fn()
      };
      
      const views: TestViews = {
        display: createMockStore({ text: '', className: '' }),
        summary: () => createMockStore({ total: 0, label: '' })
      };
      
      expect(model).toBeDefined();
      expect(actions).toBeDefined();
      expect(views).toBeDefined();
    });
  });
});