/**
 * @fileoverview React adapter performance benchmarks
 *
 * Tests the performance of the pure React adapter implementation:
 * - Hook initialization overhead
 * - State update performance in React components
 * - Re-render efficiency
 * - Subscription handling
 */

import { bench, describe } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import { useLattice } from '@lattice/store-react';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Shared test component
const createTestComponent = (itemCount: number = 100) => {
  return createComponent(() => {
    const model = createModel<{
      items: Array<{
        id: number;
        name: string;
        value: number;
        selected: boolean;
      }>;
      filter: string;
      selectItem: (id: number) => void;
      updateFilter: (filter: string) => void;
      bulkUpdate: (updates: Array<{ id: number; value: number }>) => void;
    }>(({ set, get }) => ({
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 100,
        selected: false,
      })),
      filter: '',
      selectItem: (id) => {
        const { items } = get();
        set({
          items: items.map((item) =>
            item.id === id ? { ...item, selected: !item.selected } : item
          ),
        });
      },
      updateFilter: (filter) => set({ filter }),
      bulkUpdate: (updates) => {
        const { items } = get();
        const updateMap = new Map(updates.map((u) => [u.id, u.value]));
        set({
          items: items.map((item) => {
            const newValue = updateMap.get(item.id);
            return newValue !== undefined ? { ...item, value: newValue } : item;
          }),
        });
      },
    }));

    const actions = createSlice(model, (m) => ({
      selectItem: m.selectItem,
      updateFilter: m.updateFilter,
      bulkUpdate: m.bulkUpdate,
    }));

    const filteredItems = createSlice(model, (m) => {
      if (!m.filter) return m.items;
      return m.items.filter((item) =>
        item.name.toLowerCase().includes(m.filter.toLowerCase())
      );
    });

    const stats = createSlice(
      model,
      compose({ filtered: filteredItems }, (m, { filtered }) => ({
        totalItems: m.items.length,
        filteredCount: filtered.length,
        selectedCount: m.items.filter((i) => i.selected).length,
        totalValue: m.items.reduce((sum, item) => sum + item.value, 0),
      }))
    );

    return {
      model,
      actions,
      views: {
        items: filteredItems,
        stats,
      },
    };
  });
};

describe('React Adapter Performance', () => {
  describe('Hook Initialization', () => {
    bench('React adapter - create store in hook (100 items)', () => {
      const component = createTestComponent(100);
      const { result } = renderHook(() => useLattice(component));
      // Access to prevent optimization
      result.current.actions;
    });

    bench('React adapter - create store in hook (1000 items)', () => {
      const component = createTestComponent(1000);
      const { result } = renderHook(() => useLattice(component));
      // Access to prevent optimization
      result.current.actions;
    });

    bench('React vs Zustand - store creation comparison', () => {
      const component = createTestComponent(100);

      // Time React adapter
      const reactStart = performance.now();
      const { result } = renderHook(() => useLattice(component));
      const reactEnd = performance.now();

      // Time Zustand adapter
      const zustandStart = performance.now();
      const zustandStore = createZustandAdapter(component);
      const zustandEnd = performance.now();

      // Access to prevent optimization
      result.current.actions;
      zustandStore.actions;

      const ratio = (reactEnd - reactStart) / (zustandEnd - zustandStart);
      if (ratio > 100) {
        // Prevent optimization
      }
    });
  });

  describe('State Updates in React', () => {
    bench('React adapter - 100 sequential updates', () => {
      const { result } = renderHook(() => useLattice(createTestComponent()));

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.actions.selectItem(i % 10);
        }
      });
    });

    bench('React adapter - bulk update 100 items', () => {
      const { result } = renderHook(() => useLattice(createTestComponent(100)));

      act(() => {
        const updates = Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: Math.random() * 100,
        }));

        result.current.actions.bulkUpdate(updates);
      });
    });

    bench('React adapter - rapid state changes', () => {
      const { result } = renderHook(() => useLattice(createTestComponent()));

      act(() => {
        // Simulate rapid user interactions
        for (let i = 0; i < 50; i++) {
          result.current.actions.updateFilter(`Item ${i}`);
          result.current.actions.selectItem(i % 20);
        }
      });
    });
  });

  describe('View Access Performance', () => {
    bench('React adapter - compute filtered view (1000 items)', () => {
      const { result } = renderHook(() =>
        useLattice(createTestComponent(1000))
      );

      act(() => {
        result.current.actions.updateFilter('Item 1');
      });

      // Access the view multiple times
      for (let i = 0; i < 10; i++) {
        const items = result.current.views.items();
        if (items.length === 0) break; // Prevent optimization
      }
    });

    bench('React adapter - compute stats view', () => {
      const { result } = renderHook(() =>
        useLattice(createTestComponent(1000))
      );

      // Access stats multiple times
      for (let i = 0; i < 10; i++) {
        const stats = result.current.views.stats();
        if (stats.totalItems === 0) break; // Prevent optimization
      }
    });

    bench('React adapter - mixed view access', () => {
      const { result } = renderHook(() => useLattice(createTestComponent(500)));

      act(() => {
        // Set up some initial state
        for (let i = 0; i < 10; i++) {
          result.current.actions.selectItem(i);
        }
        result.current.actions.updateFilter('Item');
      });

      // Access different views
      const items = result.current.views.items();
      const stats = result.current.views.stats();

      // Use the values to prevent optimization
      if (items.length + stats.totalItems === 0) {
        // Prevent optimization
      }
    });
  });

  describe('Subscription Performance in React', () => {
    bench('React adapter - 50 subscriptions', () => {
      const { result } = renderHook(() => useLattice(createTestComponent()));
      const unsubscribes: Array<() => void> = [];

      act(() => {
        // Create 50 subscriptions inside act
        for (let i = 0; i < 50; i++) {
          const unsub = result.current.subscribe(
            (views) => views.stats(),
            () => {} // No-op callback
          );
          unsubscribes.push(unsub);
        }

        // Trigger an update
        result.current.actions.selectItem(0);
      });

      // Cleanup inside act
      act(() => {
        unsubscribes.forEach((unsub) => unsub());
      });
    });

    bench('React adapter - subscription with React re-renders', () => {
      let renderCount = 0;

      const TestComponent = () => {
        const store = useLattice(createTestComponent());
        renderCount++;

        // Simulate component using the store
        store.views.stats();
        store.views.items();

        return null;
      };

      const { rerender } = renderHook(() => TestComponent());

      // Force re-renders inside act
      act(() => {
        for (let i = 0; i < 10; i++) {
          rerender();
        }
      });

      // Use renderCount to prevent optimization
      if (renderCount === 0) {
        // Prevent optimization
      }
    });
  });

  describe('Memory and Cleanup', () => {
    bench('React adapter - mount/unmount cycles', () => {
      const component = createTestComponent(100);

      // Simulate 10 mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const { result, unmount } = renderHook(() => useLattice(component));

        // Use the store
        act(() => {
          result.current.actions.selectItem(i);
        });

        // Unmount to trigger cleanup
        unmount();
      }
    });

    bench('React adapter - subscription cleanup', () => {
      const { result } = renderHook(() => useLattice(createTestComponent()));

      act(() => {
        // Create and immediately clean up subscriptions
        for (let i = 0; i < 100; i++) {
          const unsub = result.current.subscribe(
            (views) => views.stats(),
            () => {}
          );
          unsub(); // Immediate cleanup
        }
      });
    });
  });

  describe('React-Specific Patterns', () => {
    bench('React adapter - concurrent updates', async () => {
      const { result } = renderHook(() => useLattice(createTestComponent(100)));

      await act(async () => {
        // Simulate concurrent React updates
        await Promise.all([
          Promise.resolve().then(() => result.current.actions.selectItem(1)),
          Promise.resolve().then(() => result.current.actions.selectItem(2)),
          Promise.resolve().then(() =>
            result.current.actions.updateFilter('test')
          ),
          Promise.resolve().then(() => result.current.actions.selectItem(3)),
        ]);
      });
    });

    bench('React adapter - batched updates', () => {
      const { result } = renderHook(() => useLattice(createTestComponent()));

      act(() => {
        // React 18 automatic batching
        result.current.actions.selectItem(1);
        result.current.actions.selectItem(2);
        result.current.actions.updateFilter('batch');
        result.current.actions.selectItem(3);
        result.current.actions.selectItem(4);
      });
    });
  });
});
