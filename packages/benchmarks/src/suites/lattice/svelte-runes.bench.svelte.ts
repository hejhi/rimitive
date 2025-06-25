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
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';
import { 
  slice as runesSlice,
  combineSlices as runesCombineSlices 
} from '@lattice/frameworks/runes';
import { 
  slice as directSlice,
  combineSlices as directCombineSlices 
} from '@lattice/frameworks/svelte';

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
    const businessMetrics = $derived(
      calculateBusinessMetrics(
        state.analytics.pageViews,
        state.sales.revenue,
        state.sales.orders,
        state.analytics.users
      )
    );

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
      businessMetrics.conversion;
    }
  });

  // CURRENT: Lattice runtime-based approach (performance bottleneck)
  bench('Lattice Runtime - dashboard with adapter overhead', () => {
    const createSlice = createLatticeStore(vanillaAdapter(structuredClone(INITIAL_STATE)));

    // Analytics slice - using new concise syntax
    const analyticsSlice = createSlice(
      select('analytics'),
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
    const salesSlice = createSlice(select('sales'), ({ sales }, set) => ({
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
    const uiSlice = createSlice(select('ui'), ({ ui }, set) => ({
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
      select('analytics', 'sales'),
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

  // NEW: Lattice runes integration approach (optimized for runes)
  bench('Lattice Runes Integration - dashboard with slice() wrapper', () => {
    const createSlice = createLatticeStore(vanillaAdapter(structuredClone(INITIAL_STATE)));

    // Create core slices first
    const analyticsSlice = createSlice(
      select('analytics'),
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

    const salesSlice = createSlice(select('sales'), ({ sales }, set) => ({
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

    const uiSlice = createSlice(select('ui'), ({ ui }, set) => ({
      theme: () => ui().theme,
      toggleTheme: () =>
        set(({ ui }) => ({
          ui: {
            ...ui(),
            theme: ui().theme === 'light' ? 'dark' : 'light',
          },
        })),
    }));

    // Convert to runes-compatible functions
    const analytics = runesSlice(analyticsSlice);
    const sales = runesSlice(salesSlice);
    const ui = runesSlice(uiSlice);

    // Business metrics using combineSlices
    let computations = 0;
    const businessMetrics = runesCombineSlices(
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

  // NEW: Lattice direct Svelte integration (no stores or runes)
  bench('Lattice Direct Svelte - dashboard with direct integration', () => {
    const createSlice = createLatticeStore(vanillaAdapter(structuredClone(INITIAL_STATE)));

    // Create core slices first
    const analyticsSlice = createSlice(
      select('analytics'),
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

    const salesSlice = createSlice(select('sales'), ({ sales }, set) => ({
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

    const uiSlice = createSlice(select('ui'), ({ ui }, set) => ({
      theme: () => ui().theme,
      toggleTheme: () =>
        set(({ ui }) => ({
          ui: {
            ...ui(),
            theme: ui().theme === 'light' ? 'dark' : 'light',
          },
        })),
    }));

    // Direct Svelte integration
    const analytics = directSlice(analyticsSlice);
    const sales = directSlice(salesSlice);
    const ui = directSlice(uiSlice);

    // Business metrics using combineSlices
    let computations = 0;
    const businessMetrics = directCombineSlices(
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
    const doubled = $derived(state.count * 2);

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
    const createSlice = createLatticeStore(vanillaAdapter({ count: 0, irrelevant: 'data' }));

    let computations = 0;
    const counterSlice = createSlice(select('count'), ({ count }, set) => ({
      value: () => count(),
      doubled: () => {
        computations++;
        return count() * 2;
      },
      increment: () => set(({ count }) => ({ count: count() + 1 })),
    }));

    const irrelevantSlice = createSlice(
      select('irrelevant'),
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

  bench('Lattice Runes Integration - simple counter', () => {
    const createSlice = createLatticeStore(vanillaAdapter({ count: 0, irrelevant: 'data' }));

    // Create core slices
    let computations = 0;
    const counterSlice = createSlice(select('count'), ({ count }, set) => ({
      value: () => count(),
      doubled: () => {
        computations++;
        return count() * 2;
      },
      increment: () => set(({ count }) => ({ count: count() + 1 })),
    }));

    const irrelevantSlice = createSlice(
      select('irrelevant'),
      ({ irrelevant }, set) => ({
        value: () => irrelevant(),
        change: (newValue: string) => set(() => ({ irrelevant: newValue })),
      })
    );

    // Convert to runes-compatible functions
    const counter = runesSlice(counterSlice);
    const irrelevant = runesSlice(irrelevantSlice);
    
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      if (i % 2 === 0) {
        counter().increment(); // Relevant
      } else {
        irrelevant().change(`data-${i}`); // Irrelevant
      }

      counter().doubled(); // Force evaluation
    }
  });

  bench('Lattice Direct Svelte - simple counter', () => {
    const createSlice = createLatticeStore(vanillaAdapter({ count: 0, irrelevant: 'data' }));

    // Create core slices
    let computations = 0;
    const counterSlice = createSlice(select('count'), ({ count }, set) => ({
      value: () => count(),
      doubled: () => {
        computations++;
        return count() * 2;
      },
      increment: () => set(({ count }) => ({ count: count() + 1 })),
    }));

    const irrelevantSlice = createSlice(
      select('irrelevant'),
      ({ irrelevant }, set) => ({
        value: () => irrelevant(),
        change: (newValue: string) => set(() => ({ irrelevant: newValue })),
      })
    );

    // Direct Svelte integration
    const counter = directSlice(counterSlice);
    const irrelevant = directSlice(irrelevantSlice);
    
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
