/**
 * @fileoverview Runes-Native vs Runtime vs Raw Svelte Performance Comparison
 *
 * This benchmark compares three approaches:
 * 1. Raw Svelte 5 runes (baseline performance)
 * 2. Lattice runtime-based approach (current implementation)
 * 3. Lattice runes-native approach (new zero-overhead implementation)
 *
 * Goal: Demonstrate that runes-native approach matches or exceeds raw Svelte
 * performance while providing Lattice's organizational benefits.
 */

import { describe, bench } from 'vitest';
import { createLatticeStore, select as $ } from '@lattice/core';
import {
  createSvelteSlices,
  combineSlices,
  svelteRunesAdapter,
} from '@lattice/frameworks/runes';

// Complex business calculation for realistic benchmarking
function calculateBusinessMetrics(
  pageViews: number,
  revenue: number,
  orders: number,
  users: number
): { conversion: number; rpu: number; complex: number } {
  let complex = 0;
  for (let i = 1; i <= 100; i++) {
    complex += (pageViews * revenue) / (i * users + 1);
  }

  return {
    conversion: orders / users,
    rpu: revenue / users,
    complex,
  };
}

// Shared test data
const INITIAL_STATE = {
  analytics: { pageViews: 1000, users: 250 },
  sales: { revenue: 50000, orders: 125 },
  ui: { theme: 'light', sidebar: true },
};

const UPDATE_ITERATIONS = 300;

describe('Runes Performance Comparison - Complex Business Dashboard', () => {
  // BASELINE: Raw Svelte 5 runes (optimal performance)
  bench('Raw Svelte Runes - dashboard with business logic', () => {
    const state = $state(structuredClone(INITIAL_STATE));

    // Business metrics computation using pure $derived
    let computations = 0;
    const businessMetrics = $derived(() => {
      computations++;
      return calculateBusinessMetrics(
        state.analytics.pageViews,
        state.sales.revenue,
        state.sales.orders,
        state.analytics.users
      );
    });

    // Update functions
    const updateAnalytics = () => {
      state.analytics.pageViews += 10;
      state.analytics.users += 2;
    };

    const updateSales = () => {
      state.sales.revenue += 1000;
      state.sales.orders += 3;
    };

    const updateUI = () => {
      state.ui.theme = state.ui.theme === 'light' ? 'dark' : 'light';
    };

    // Realistic update pattern
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      const updateType = i % 4;
      switch (updateType) {
        case 0:
          updateAnalytics(); // Relevant - will trigger computation
          break;
        case 1:
          updateSales(); // Relevant - will trigger computation
          break;
        case 2:
        case 3:
          updateUI(); // Irrelevant - should NOT trigger computation
          break;
      }

      // Force evaluation
      businessMetrics().conversion;
    }
  });

  // CURRENT: Lattice runtime-based approach (performance bottleneck)
  bench('Lattice Runtime - dashboard with adapter overhead', () => {
    const state = $state(structuredClone(INITIAL_STATE));
    const adapter = svelteRunesAdapter(state);
    const createSlice = createLatticeStore(adapter);

    // Analytics slice - using new concise syntax
    const analyticsSlice = createSlice(
      $('analytics'),
      ({ analytics }, set) => ({
        pageViews: () => analytics().pageViews,
        users: () => analytics().users,
        updateMetrics: () =>
          set(({ analytics }) => ({
            analytics: {
              pageViews: analytics().pageViews + 10,
              users: analytics().users + 2,
            },
          })),
      })
    );

    // Sales slice
    const salesSlice = createSlice($('sales'), ({ sales }, set) => ({
      revenue: () => sales().revenue,
      orders: () => sales().orders,
      updateMetrics: () =>
        set(({ sales }) => ({
          sales: {
            revenue: sales().revenue + 1000,
            orders: sales().orders + 3,
          },
        })),
    }));

    // UI slice
    const uiSlice = createSlice($('ui'), ({ ui }, set) => ({
      theme: () => ui().theme,
      toggleTheme: () =>
        set(({ ui }) => ({
          ui: {
            ...ui(),
            theme: ui().theme === 'light' ? 'dark' : 'light',
          },
        })),
    }));

    // Business metrics slice
    let computations = 0;
    const businessSlice = createSlice(
      $('analytics', 'sales'),
      ({ analytics, sales }) => ({
        metrics: () => {
          computations++;
          return calculateBusinessMetrics(
            analytics().pageViews,
            sales().revenue,
            sales().orders,
            analytics().users
          );
        },
      })
    );

    // Same update pattern
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      const updateType = i % 4;
      switch (updateType) {
        case 0:
          analyticsSlice().updateMetrics(); // Relevant
          break;
        case 1:
          salesSlice().updateMetrics(); // Relevant
          break;
        case 2:
        case 3:
          uiSlice().toggleTheme(); // Irrelevant
          break;
      }

      // Force evaluation
      businessSlice().metrics();
    }
  });

  // NEW: Lattice runes-native approach (zero overhead)
  bench('Lattice Runes-Native - zero overhead dashboard', () => {
    const createSlice = createSvelteSlices(structuredClone(INITIAL_STATE));

    // Analytics slice
    const analytics = createSlice($('analytics'), ({ analytics }, { set }) => ({
      pageViews: () => analytics.pageViews,
      users: () => analytics.users,
      updateMetrics: () =>
        set('analytics', {
          pageViews: analytics.pageViews + 10,
          users: analytics.users + 2,
        }),
    }));

    // Sales slice
    const sales = createSlice($('sales'), ({ sales }, { set }) => ({
      revenue: () => sales.revenue,
      orders: () => sales.orders,
      updateMetrics: () =>
        set('sales', {
          revenue: sales.revenue + 1000,
          orders: sales.orders + 3,
        }),
    }));

    // UI slice
    const ui = createSlice($('ui'), ({ ui }, { set }) => ({
      theme: () => ui.theme,
      toggleTheme: () =>
        set('ui', {
          ...ui,
          theme: ui.theme === 'light' ? 'dark' : 'light',
        }),
    }));

    // Business metrics slice using combineSlices
    let computations = 0;
    const businessMetrics = combineSlices(
      { analytics, sales },
      ({ analytics: analyticsData, sales: salesData }) => {
        computations++;
        return calculateBusinessMetrics(
          analyticsData.pageViews(),
          salesData.revenue(),
          salesData.orders(),
          analyticsData.users()
        );
      }
    );

    // Same update pattern
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      const updateType = i % 4;
      switch (updateType) {
        case 0:
          analytics().updateMetrics(); // Relevant
          break;
        case 1:
          sales().updateMetrics(); // Relevant
          break;
        case 2:
        case 3:
          ui().toggleTheme(); // Irrelevant
          break;
      }

      // Force evaluation
      businessMetrics();
    }
  });
});

describe('Runes Performance Comparison - Simple Counter', () => {
  // Simpler test to isolate the overhead differences

  bench('Raw Svelte Runes - simple counter', () => {
    const state = $state({ count: 0, irrelevant: 'data' });

    let computations = 0;
    const doubled = $derived(() => {
      computations++;
      return state.count * 2;
    });

    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      if (i % 2 === 0) {
        state.count++; // Relevant
      } else {
        state.irrelevant = `data-${i}`; // Irrelevant
      }

      // Access the derived value to force evaluation
      const _ = doubled;
      void _;
    }
  });

  bench('Lattice Runtime - simple counter', () => {
    const state = $state({ count: 0, irrelevant: 'data' });
    const adapter = svelteRunesAdapter(state);
    const createSlice = createLatticeStore(adapter);

    let computations = 0;
    const counterSlice = createSlice($('count'), ({ count }, set) => ({
      value: () => count(),
      doubled: () => {
        computations++;
        return count() * 2;
      },
      increment: () => set(({ count }) => ({ count: count() + 1 })),
    }));

    const irrelevantSlice = createSlice(
      $('irrelevant'),
      ({ irrelevant }, set) => ({
        value: () => irrelevant(),
        change: (newValue: string) => set(() => ({ irrelevant: newValue })),
      })
    );

    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      if (i % 2 === 0) {
        counterSlice().increment(); // Relevant
      } else {
        irrelevantSlice().change(`data-${i}`); // Irrelevant
      }

      counterSlice().doubled(); // Force evaluation
    }
  });

  bench('Lattice Runes-Native - simple counter', () => {
    const createSlice = createSvelteSlices({ count: 0, irrelevant: 'data' });

    let computations = 0;
    const counter = createSlice($('count'), ({ count }, { set }) => ({
      value: () => count,
      doubled: () => {
        computations++;
        return count * 2;
      },
      increment: () => set('count', count + 1),
    }));

    const irrelevant = createSlice(
      $('irrelevant'),
      ({ irrelevant }, { set }) => ({
        value: () => irrelevant,
        change: (newValue: string) => set('irrelevant', newValue),
      })
    );

    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      if (i % 2 === 0) {
        counter().increment(); // Relevant
      } else {
        irrelevant().change(`data-${i}`); // Irrelevant
      }

      counter().doubled(); // Force evaluation
    }
  });
});
