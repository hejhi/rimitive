/**
 * @fileoverview React bindings for the Redux adapter
 *
 * Provides React hooks that integrate Lattice components with React Redux.
 */

import { useRef, useSyncExternalStore, useCallback } from 'react';
import type { ReduxAdapterResult } from './index';

/**
 * Custom hook for accessing views with proper subscriptions
 */
export function useView<
  Model,
  Actions,
  Views,
  K extends keyof Views,
  ViewGetter = ReduxAdapterResult<Model, Actions, Views>['views'][K],
>(
  store: ReduxAdapterResult<Model, Actions, Views>,
  selector: (
    views: ReduxAdapterResult<Model, Actions, Views>['views']
  ) => ViewGetter
): ViewGetter extends () => infer R ? R : never {
  // Get the view getter
  const viewGetter = selector(store.views);

  // Create stable subscribe function
  const subscribe = useCallback(
    (callback: () => void) => {
      return store.subscribe(callback);
    },
    [store]
  );

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
    if (
      resultCacheRef.current === undefined ||
      lastStateRef.current !== stateString
    ) {
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
  store: ReduxAdapterResult<Model, Actions, Views>
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
  const { describe, it, expect, afterEach } = import.meta.vitest;
  const { renderHook, act, cleanup } = await import('@testing-library/react');
  const { createComponent, createModel, createSlice, compose } = await import(
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

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            onClick: actions.increment,
            disabled: m.disabled,
            'aria-label': `Increment counter`,
          }))
        );

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
      const { result } = renderHook(() =>
        useView(store, (views) => views.display)
      );

      const displayData = result.current;
      expect(displayData.value).toBe(0);
      expect(displayData.label).toBe('Count: 0');

      // Update state
      act(() => {
        store.actions.increment();
      });

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Hook should update
      const updatedDisplayData = result.current;
      expect(updatedDisplayData.value).toBe(1);
      expect(updatedDisplayData.label).toBe('Count: 1');
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

    it('should handle views', async () => {
      const component = createTestComponent();
      const store = createReduxAdapter(component);

      const { result } = renderHook(() =>
        useView(store, (views) => views.button)
      );

      const buttonData = result.current;
      expect(buttonData.disabled).toBe(false);
      expect(buttonData['aria-label']).toBe('Increment counter');
      expect(typeof buttonData.onClick).toBe('function');

      // Test that onClick works
      act(() => {
        buttonData.onClick();
      });

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));

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

      const { result, rerender } = renderHook(() =>
        useView(store, (views) => views[currentTab])
      );

      const tabData = result.current;
      expect(tabData.content).toBe('Content 1');
      expect(tabData.isActive).toBe(true);

      // Change tab
      currentTab = 'tab2';
      rerender();

      const tab2Data = result.current;
      expect(tab2Data.content).toBe('Content 2');
      expect(tab2Data.isActive).toBe(false);

      // Make tab2 active
      act(() => {
        store.actions.setActiveTab('tab2');
      });

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      const activeTabData = result.current;
      expect(activeTabData.isActive).toBe(true);
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

        const statsView = createSlice(model, (_m, api) => {
          const state = api.executeSlice(itemsSlice);
          return {
            count: state.items.length,
            sum: state.items.reduce((a, b) => a + b, 0),
            average: state.items.reduce((a, b) => a + b, 0) / state.items.length,
          };
        });

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

      const { result } = renderHook(() =>
        useView(store, (views) => views.stats)
      );

      const statsData = result.current;
      expect(statsData.count).toBe(3);
      expect(statsData.sum).toBe(6);
      expect(statsData.average).toBe(2);

      // Add item
      act(() => {
        store.actions.addItem(4);
      });

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      const updatedStatsData = result.current;
      expect(updatedStatsData.count).toBe(4);
      expect(updatedStatsData.sum).toBe(10);
      expect(updatedStatsData.average).toBe(2.5);
    });
  });
}
