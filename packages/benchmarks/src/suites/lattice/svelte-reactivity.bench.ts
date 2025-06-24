/**
 * @fileoverview Svelte Reactivity Performance Benchmark
 *
 * Compares Lattice's fine-grained Svelte utilities against regular Svelte derived stores
 * in scenarios with complex state where traditional derived stores over-trigger.
 *
 * Key insight: Regular Svelte derived stores recalculate whenever ANY dependency changes.
 * Lattice's utilities only recalculate when the specific slice dependencies change.
 *
 * Metrics measured:
 * - Execution time (via Vitest benchmark)
 * - Memory allocation and cleanup
 * - Subscription overhead
 * - Derivation efficiency
 */

import { describe, bench } from 'vitest';
import { writable, derived, get } from 'svelte/store';
import { createStore, select as $ } from '@lattice/core';
import { combineSlices, sliceDerived } from '@lattice/frameworks/svelte';

// Memory and performance tracking utilities
function measureMemoryAndPerformance<T>(fn: () => T): {
  result: T;
  stats: { executionTime: number; memoryDelta: number };
} {
  const beforeMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const startTime = performance.now();

  const result = fn();

  const endTime = performance.now();
  const afterMemory = (performance as any).memory?.usedJSHeapSize || 0;

  const stats = {
    executionTime: endTime - startTime,
    memoryDelta: afterMemory - beforeMemory,
  };

  return { result, stats };
}

function forceGC() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
}

// Realistic computation that might exist in a real app
function expensiveBusinessLogic(counter: number, user: string): string {
  // Simulate real-world computation: string manipulation + math
  let result = '';
  for (let i = 0; i < 500; i++) {
    result += `${user}-${counter}-${Math.sqrt(i)}`.slice(0, 10);
  }
  return result;
}

// Test scenario: Multiple independent state domains that get combined into derived views
const INITIAL_STATE = {
  counter: 0,
  user: 'Alice',
  cart: { items: 0, total: 0 },
  auth: { isLoggedIn: true, role: 'user' },
  ui: { theme: 'light', sidebar: false },
  metrics: { views: 0, clicks: 0 },
};

const UPDATE_ITERATIONS = 1000;

describe('Svelte Reactivity - Performance & Memory Comparison', () => {
  // Baseline: Regular Svelte stores with traditional derived
  {
    const setupSvelteStores = () => {
      // Separate stores for each domain
      const counter = writable(INITIAL_STATE.counter);
      const user = writable(INITIAL_STATE.user);
      const cart = writable(INITIAL_STATE.cart);
      const auth = writable(INITIAL_STATE.auth);
      const ui = writable(INITIAL_STATE.ui);
      const metrics = writable(INITIAL_STATE.metrics);

      // Derived stores with proper Svelte dependency tracking
      // These will only recalculate when their specific dependencies change
      const summary = derived([counter, user], ([c, u]) => `${u}: ${c} clicks`);

      // Track how many times our "expensive" computation runs
      let computationCount = 0;
      const expensiveView = derived([counter, user], ([c, u]) => {
        computationCount++;
        // Use realistic business logic computation
        return expensiveBusinessLogic(c, u);
      });

      return {
        stores: { counter, user, cart, auth, ui, metrics },
        derived: { summary, expensiveView },
        getComputationCount: () => computationCount,
        updateCounter: () => counter.update((n) => n + 1),
        updateUser: () => user.set(`User${Math.random()}`),
        updateCart: () => cart.update((c) => ({ ...c, items: c.items + 1 })),
        updateAuth: () =>
          auth.update((a) => ({
            ...a,
            role: a.role === 'user' ? 'admin' : 'user',
          })),
        updateUI: () =>
          ui.update((u) => ({
            ...u,
            theme: u.theme === 'light' ? 'dark' : 'light',
          })),
        updateMetrics: () =>
          metrics.update((m) => ({ ...m, views: m.views + 1 })),
      };
    };

    let svelteSetup: ReturnType<typeof setupSvelteStores>;

    bench(
      'Svelte Derived - complex state (proper dependencies)',
      () => {
        // Mix of updates: some relevant to derived, some not
        // Note: Irrelevant updates should NOT trigger derived recalculation
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const updateType = i % 6;
          switch (updateType) {
            case 0:
              svelteSetup.updateCounter();
              break; // Relevant - will trigger derived
            case 1:
              svelteSetup.updateUser();
              break; // Relevant - will trigger derived
            case 2:
              svelteSetup.updateCart();
              break; // Irrelevant - should NOT trigger derived
            case 3:
              svelteSetup.updateAuth();
              break; // Irrelevant - should NOT trigger derived
            case 4:
              svelteSetup.updateUI();
              break; // Irrelevant - should NOT trigger derived
            case 5:
              svelteSetup.updateMetrics();
              break; // Irrelevant - should NOT trigger derived
          }

          // Force derivation by accessing values (simulates component reactivity)
          get(svelteSetup.derived.summary);
          get(svelteSetup.derived.expensiveView);
        }
      },
      {
        setup: () => {
          forceGC();
          measureMemoryAndPerformance(() => {
            svelteSetup = setupSvelteStores();
          });
        },
        teardown: () => {
          svelteSetup.getComputationCount();

          // Cleanup measurement
          measureMemoryAndPerformance(() => {
            svelteSetup = null as any;
          });
        },
      }
    );
  }

  // Lattice: Fine-grained reactive slices with combineSlices
  {
    const setupLatticeSlices = () => {
      const createSlice = createStore(INITIAL_STATE);

      // Create focused slices for each domain
      const counterSlice = createSlice($('counter'), ({ counter }, set) => ({
        value: () => counter(),
        increment: () => set(({ counter }) => ({ counter: counter() + 1 })),
      }));

      const userSlice = createSlice($('user'), ({ user }, set) => ({
        name: () => user(),
        setName: (name: string) => set(() => ({ user: name })),
      }));

      const cartSlice = createSlice($('cart'), ({ cart }, set) => ({
        items: () => cart().items,
        addItem: () =>
          set(({ cart }) => ({ cart: { ...cart(), items: cart().items + 1 } })),
      }));

      const authSlice = createSlice($('auth'), ({ auth }, set) => ({
        role: () => auth().role,
        toggleRole: () =>
          set(({ auth }) => ({
            auth: {
              ...auth(),
              role: auth().role === 'user' ? 'admin' : 'user',
            },
          })),
      }));

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

      const metricsSlice = createSlice($('metrics'), ({ metrics }, set) => ({
        views: () => metrics().views,
        incrementViews: () =>
          set(({ metrics }) => ({
            metrics: { ...metrics(), views: metrics().views + 1 },
          })),
      }));

      // Combine only the slices we actually need (fine-grained!)
      const summary = combineSlices(
        [counterSlice, userSlice] as const,
        (counter, user) => `${user.name()}: ${counter.value()} clicks`
      );

      // Track computation count for expensive derived
      let computationCount = 0;
      const expensiveView = combineSlices(
        [counterSlice, userSlice] as const, // Only depends on these 2 slices!
        (counter, user) => {
          computationCount++;
          // Same realistic business logic computation
          return expensiveBusinessLogic(counter.value(), user.name());
        }
      );

      return {
        slices: {
          counterSlice,
          userSlice,
          cartSlice,
          authSlice,
          uiSlice,
          metricsSlice,
        },
        derived: { summary, expensiveView },
        getComputationCount: () => computationCount,
        updateCounter: () => counterSlice().increment(),
        updateUser: () => userSlice().setName(`User${Math.random()}`),
        updateCart: () => cartSlice().addItem(),
        updateAuth: () => authSlice().toggleRole(),
        updateUI: () => uiSlice().toggleTheme(),
        updateMetrics: () => metricsSlice().incrementViews(),
      };
    };

    let latticeSetup: ReturnType<typeof setupLatticeSlices>;

    bench(
      'Lattice combineSlices - complex state (fine-grained)',
      () => {
        // Same update pattern - mix of relevant and irrelevant updates
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const updateType = i % 6;
          switch (updateType) {
            case 0:
              latticeSetup.updateCounter();
              break; // Relevant
            case 1:
              latticeSetup.updateUser();
              break; // Relevant
            case 2:
              latticeSetup.updateCart();
              break; // Irrelevant - WON'T trigger expensive recalculation!
            case 3:
              latticeSetup.updateAuth();
              break; // Irrelevant - WON'T trigger expensive recalculation!
            case 4:
              latticeSetup.updateUI();
              break; // Irrelevant - WON'T trigger expensive recalculation!
            case 5:
              latticeSetup.updateMetrics();
              break; // Irrelevant - WON'T trigger expensive recalculation!
          }

          // Force evaluation (simulates component reactivity)
          get(latticeSetup.derived.summary);
          get(latticeSetup.derived.expensiveView);
        }
      },
      {
        setup: () => {
          forceGC();
          measureMemoryAndPerformance(() => {
            latticeSetup = setupLatticeSlices();
          });
        },
        teardown: () => {
          latticeSetup.getComputationCount();

          // Cleanup measurement
          measureMemoryAndPerformance(() => {
            latticeSetup = null as any;
          });
        },
      }
    );
  }
});

describe('Svelte Reactivity - Detailed Analysis', () => {
  // This benchmark specifically measures unnecessary recalculations
  bench('Analysis: Svelte derived with proper dependencies', () => {
    const setupAnalysis = () => {
      const counter = writable(0);
      const unrelated = writable('foo');

      let expensiveComputations = 0;
      // FIXED: Only depend on counter since that's all we use
      const expensive = derived(counter, (c) => {
        expensiveComputations++;
        // Use realistic computation
        return expensiveBusinessLogic(c, 'analysis');
      });

      return {
        counter,
        unrelated,
        expensive,
        getCount: () => expensiveComputations,
      };
    };

    const analysis = setupAnalysis();

    // Update only unrelated state 100 times
    for (let i = 0; i < 100; i++) {
      analysis.unrelated.set(`foo${i}`);
      get(analysis.expensive); // Try to force recalculation
    }

    // With proper dependencies, expensive computation runs only 1 time (initial)
    // This shows Svelte's derived stores ARE efficient when used correctly
  });

  bench('Analysis: Count Lattice fine-grained computations', () => {
    const setupAnalysis = () => {
      const createSlice = createStore({ counter: 0, unrelated: 'foo' });

      const counterSlice = createSlice($('counter'), ({ counter }, set) => ({
        value: () => counter(),
        increment: () => set(({ counter }) => ({ counter: counter() + 1 })),
      }));

      const unrelatedSlice = createSlice(
        $('unrelated'),
        ({ unrelated }, set) => ({
          value: () => unrelated(),
          setValue: (value: string) => set(() => ({ unrelated: value })),
        })
      );

      let expensiveComputations = 0;
      const expensive = sliceDerived(counterSlice, (counter) => {
        expensiveComputations++;
        // Same realistic computation
        return expensiveBusinessLogic(counter.value(), 'analysis');
      });

      return {
        counterSlice,
        unrelatedSlice,
        expensive,
        getCount: () => expensiveComputations,
      };
    };

    const analysis = setupAnalysis();

    // Update only unrelated state 100 times
    for (let i = 0; i < 100; i++) {
      analysis.unrelatedSlice().setValue(`foo${i}`);
      get(analysis.expensive); // Try to force recalculation
    }

    // The expensive computation only runs 1 time (initial)!
    // Lattice's fine-grained reactivity prevents unnecessary work
  });
});
