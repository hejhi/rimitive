/**
 * @fileoverview React bindings for the Redux adapter
 * 
 * Provides React hooks that integrate Lattice components with React Redux.
 */

import { useSelector as useReduxSelector } from 'react-redux';
import { useRef, useMemo, useSyncExternalStore, useCallback } from 'react';
import type { LatticeReduxStore } from './index';

/**
 * Custom hook for accessing views with proper subscriptions
 */
export function useView<Model, Actions, Views, K extends keyof Views>(
  store: LatticeReduxStore<Model, Actions, Views>,
  selector: (views: Views) => Views[K]
): Views[K] extends () => infer R ? R : never {
  // Get the view getter
  const viewGetter = selector(store.views);
  
  // Create stable subscribe function
  const subscribe = useCallback((callback: () => void) => {
    return store.subscribe(callback);
  }, [store]);
  
  // Use a ref to track the current view getter to detect changes
  const viewGetterRef = useRef(viewGetter);
  const resultCacheRef = useRef<any>();
  const lastStateRef = useRef<string>();
  
  // Update ref when viewGetter changes
  if (viewGetterRef.current !== viewGetter) {
    viewGetterRef.current = viewGetter;
    // Clear cache to force recomputation
    resultCacheRef.current = undefined;
  }
  
  // Create stable getSnapshot function
  const getSnapshot = useCallback(() => {
    const currentState = store.getState();
    const stateString = JSON.stringify(currentState);
    
    // Recompute if state changed or cache is empty
    if (resultCacheRef.current === undefined || lastStateRef.current !== stateString) {
      resultCacheRef.current = (viewGetterRef.current as any)();
      lastStateRef.current = stateString;
    }
    
    return resultCacheRef.current;
  }, [store]);
  
  // Subscribe to store changes
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot // Server snapshot is the same
  );

  return snapshot;
}

/**
 * Get all actions as a stable reference object
 */
export function useActions<Model, Actions, Views>(
  store: LatticeReduxStore<Model, Actions, Views>
): Actions {
  // Actions are stable, so we can just return them
  return store.actions;
}

/**
 * Re-export the standard React Redux useSelector for convenience
 */
export { useSelector } from 'react-redux';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi, afterEach } = import.meta.vitest;
  const { renderHook, act, cleanup } = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { Provider } = await import('react-redux');
  const { configureStore } = await import('@reduxjs/toolkit');
  const { createComponent, createModel, createSlice, select } = await import(
    '@lattice/core'
  );
  const { createReduxAdapter } = await import('./index');

  describe('React Redux Integration', () => {
    afterEach(() => {
      cleanup();
    });

    function createTestComponent() {
      return createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          disabled: boolean;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          disabled: false,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        const displaySlice = createSlice(model, (m) => ({
          value: m.count,
          label: `Count: ${m.count}`,
        }));

        const buttonSlice = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          disabled: m.disabled,
          'aria-label': `Increment counter`,
        }));

        return {
          model,
          actions,
          views: {
            display: displaySlice,
            button: buttonSlice,
          },
        };
      });
    }

    it('should provide working useView hook', async () => {
      const component = createTestComponent();
      const store = createReduxAdapter(component);

      // We don't need a Redux Provider for our custom hooks
      const { result } = renderHook(
        () => useView(store, (views) => views.display)
      );

      expect(result.current.value).toBe(0);
      expect(result.current.label).toBe('Count: 0');

      // Update state
      act(() => {
        store.actions.increment();
      });

      // Wait for next tick
      await new Promise(resolve => setTimeout(resolve, 0));

      // Hook should update
      expect(result.current.value).toBe(1);
      expect(result.current.label).toBe('Count: 1');
    });

    it('should provide stable actions through useActions', () => {
      const component = createTestComponent();
      const store = createReduxAdapter(component);

      const { result, rerender } = renderHook(() => useActions(store));

      const firstActions = result.current;

      // Rerender
      rerender();

      const secondActions = result.current;

      // Actions should be the same reference
      expect(firstActions).toBe(secondActions);
      expect(firstActions.increment).toBe(secondActions.increment);
    });

    it('should handle views with select() markers', async () => {
      const component = createTestComponent();
      const store = createReduxAdapter(component);

      const { result } = renderHook(
        () => useView(store, (views) => views.button)
      );

      expect(result.current.disabled).toBe(false);
      expect(result.current['aria-label']).toBe('Increment counter');
      expect(typeof result.current.onClick).toBe('function');

      // Test that onClick works
      act(() => {
        result.current.onClick();
      });

      // Wait for next tick
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify state was updated
      expect(store.getState().count).toBe(1);
    });

    it('should support dynamic view selection', async () => {
      const component = createComponent(() => {
        const model = createModel<{
          activeTab: 'tab1' | 'tab2';
          tab1Content: string;
          tab2Content: string;
          setActiveTab: (tab: 'tab1' | 'tab2') => void;
        }>(({ set }) => ({
          activeTab: 'tab1',
          tab1Content: 'Content 1',
          tab2Content: 'Content 2',
          setActiveTab: (tab) => set({ activeTab: tab }),
        }));

        const tab1Slice = createSlice(model, (m) => ({
          content: m.tab1Content,
          isActive: m.activeTab === 'tab1',
        }));

        const tab2Slice = createSlice(model, (m) => ({
          content: m.tab2Content,
          isActive: m.activeTab === 'tab2',
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setActiveTab: m.setActiveTab,
          })),
          views: {
            tab1: tab1Slice,
            tab2: tab2Slice,
          },
        };
      });

      const store = createReduxAdapter(component);

      let currentTab: 'tab1' | 'tab2' = 'tab1';

      const { result, rerender } = renderHook(
        () => useView(store, (views) => views[currentTab])
      );

      expect(result.current.content).toBe('Content 1');
      expect(result.current.isActive).toBe(true);

      // Change tab
      currentTab = 'tab2';
      rerender();

      expect(result.current.content).toBe('Content 2');
      expect(result.current.isActive).toBe(false);

      // Make tab2 active
      act(() => {
        store.actions.setActiveTab('tab2');
      });

      // Wait for next tick
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.isActive).toBe(true);
    });

    it('should handle computed views', async () => {
      const component = createComponent(() => {
        const model = createModel<{
          items: number[];
          addItem: (item: number) => void;
        }>(({ set, get }) => ({
          items: [1, 2, 3],
          addItem: (item) => set({ items: [...get().items, item] }),
        }));

        const itemsSlice = createSlice(model, (m) => ({
          items: m.items,
        }));

        const statsView = () =>
          itemsSlice((state) => ({
            count: state.items.length,
            sum: state.items.reduce((a, b) => a + b, 0),
            average: state.items.reduce((a, b) => a + b, 0) / state.items.length,
          }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addItem: m.addItem,
          })),
          views: {
            stats: statsView,
          },
        };
      });

      const store = createReduxAdapter(component);

      const { result } = renderHook(
        () => useView(store, (views) => views.stats)
      );

      expect(result.current.count).toBe(3);
      expect(result.current.sum).toBe(6);
      expect(result.current.average).toBe(2);

      // Add item
      act(() => {
        store.actions.addItem(4);
      });

      // Wait for next tick
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.count).toBe(4);
      expect(result.current.sum).toBe(10);
      expect(result.current.average).toBe(2.5);
    });
  });
}