/**
 * @fileoverview Adapter performance benchmarks
 * 
 * Compares performance across different Lattice adapters:
 * - Store creation overhead
 * - State update performance
 * - Subscription handling
 * - View computation efficiency
 */

import { bench, describe } from 'vitest';
import { createComponent, createModel, createSlice, compose } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
// Note: React adapter benchmarks removed as they require React testing environment

// Shared test component
const createTestComponent = (itemCount: number = 100) => {
  return createComponent(() => {
    const model = createModel<{
      items: Array<{ id: number; name: string; value: number; selected: boolean }>;
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
            return newValue !== undefined
              ? { ...item, value: newValue }
              : item;
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

describe('Adapter Performance Comparison', () => {
  describe('Store Creation', () => {
    bench('Zustand adapter - create store (100 items)', () => {
      const component = createTestComponent(100);
      createZustandAdapter(component);
    });

    bench('Redux adapter - create store (100 items)', () => {
      const component = createTestComponent(100);
      createReduxAdapter(component);
    });


    bench('Zustand adapter - create store (1000 items)', () => {
      const component = createTestComponent(1000);
      createZustandAdapter(component);
    });

    bench('Redux adapter - create store (1000 items)', () => {
      const component = createTestComponent(1000);
      createReduxAdapter(component);
    });
  });

  describe('State Updates', () => {
    bench('Zustand - 100 sequential updates', () => {
      const store = createZustandAdapter(createTestComponent());
      
      for (let i = 0; i < 100; i++) {
        store.actions.selectItem(i % 10);
      }
    });

    bench('Redux - 100 sequential updates', () => {
      const store = createReduxAdapter(createTestComponent());
      
      for (let i = 0; i < 100; i++) {
        store.actions.selectItem(i % 10);
      }
    });


    bench('Zustand - bulk update 100 items', () => {
      const store = createZustandAdapter(createTestComponent(100));
      
      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
      }));
      
      store.actions.bulkUpdate(updates);
    });

    bench('Redux - bulk update 100 items', () => {
      const store = createReduxAdapter(createTestComponent(100));
      
      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
      }));
      
      store.actions.bulkUpdate(updates);
    });
  });

  describe('View Computation', () => {
    bench('Zustand - compute filtered view (1000 items, 10% match)', () => {
      const store = createZustandAdapter(createTestComponent(1000));
      store.actions.updateFilter('Item 1'); // Matches ~100 items
      
      // Access the view 10 times
      for (let i = 0; i < 10; i++) {
        store.views.items();
      }
    });

    bench('Redux - compute filtered view (1000 items, 10% match)', () => {
      const store = createReduxAdapter(createTestComponent(1000));
      store.actions.updateFilter('Item 1'); // Matches ~100 items
      
      // Access the view 10 times
      for (let i = 0; i < 10; i++) {
        store.views.items();
      }
    });

    bench('Zustand - compute stats view', () => {
      const store = createZustandAdapter(createTestComponent(1000));
      
      // Access stats 10 times
      for (let i = 0; i < 10; i++) {
        store.views.stats();
      }
    });

    bench('Redux - compute stats view', () => {
      const store = createReduxAdapter(createTestComponent(1000));
      
      // Access stats 10 times
      for (let i = 0; i < 10; i++) {
        store.views.stats();
      }
    });
  });

  describe('Subscription Performance', () => {
    bench('Zustand - 100 subscriptions', () => {
      const store = createZustandAdapter(createTestComponent());
      const unsubscribes: Array<() => void> = [];
      
      // Create 100 subscriptions
      for (let i = 0; i < 100; i++) {
        const unsub = store.subscribe(
          (views) => views.stats(),
          () => {} // No-op callback
        );
        unsubscribes.push(unsub);
      }
      
      // Trigger an update
      store.actions.selectItem(0);
      
      // Cleanup
      unsubscribes.forEach((unsub) => unsub());
    });

    bench('Redux - 100 subscriptions', () => {
      const store = createReduxAdapter(createTestComponent());
      const unsubscribes: Array<() => void> = [];
      
      // Create 100 subscriptions
      for (let i = 0; i < 100; i++) {
        const unsub = store.subscribe(
          (views) => views.stats(),
          () => {} // No-op callback
        );
        unsubscribes.push(unsub);
      }
      
      // Trigger an update
      store.actions.selectItem(0);
      
      // Cleanup
      unsubscribes.forEach((unsub) => unsub());
    });

    bench('Zustand - subscription with complex selector', () => {
      const store = createZustandAdapter(createTestComponent(100));
      
      const unsub = store.subscribe(
        (views) => {
          const items = views.items();
          const stats = views.stats();
          return {
            items: items.slice(0, 10),
            ...stats,
            averageValue: stats.totalValue / stats.totalItems,
          };
        },
        () => {} // No-op callback
      );
      
      // Trigger 10 updates
      for (let i = 0; i < 10; i++) {
        store.actions.selectItem(i);
      }
      
      unsub();
    });

    bench('Redux - subscription with complex selector', () => {
      const store = createReduxAdapter(createTestComponent(100));
      
      const unsub = store.subscribe(
        (views) => {
          const items = views.items();
          const stats = views.stats();
          return {
            items: items.slice(0, 10),
            ...stats,
            averageValue: stats.totalValue / stats.totalItems,
          };
        },
        () => {} // No-op callback
      );
      
      // Trigger 10 updates
      for (let i = 0; i < 10; i++) {
        store.actions.selectItem(i);
      }
      
      unsub();
    });
  });
});