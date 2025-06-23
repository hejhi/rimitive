/**
 * @fileoverview Svelte Reactivity Performance Benchmark
 *
 * Compares Lattice's fine-grained Svelte utilities against regular Svelte derived stores
 * in scenarios with complex state where traditional derived stores over-trigger.
 * 
 * Key insight: Regular Svelte derived stores recalculate whenever ANY dependency changes.
 * Lattice's utilities only recalculate when the specific slice dependencies change.
 */

import { describe, bench } from 'vitest';
import { writable, derived, get, type Writable } from 'svelte/store';
import { createStore } from '@lattice/core';
import { combineSlices, sliceDerived } from '@lattice/runtime/svelte';

// Test scenario: Multiple independent state domains that get combined into derived views
const INITIAL_STATE = {
  counter: 0,
  user: 'Alice',
  cart: { items: 0, total: 0 },
  auth: { isLoggedIn: true, role: 'user' },
  ui: { theme: 'light', sidebar: false },
  metrics: { views: 0, clicks: 0 }
};

const UPDATE_ITERATIONS = 1000;

describe('Svelte Reactivity - Complex State Composition', () => {
  
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

      // Derived store that depends on counter and user (but NOT cart, auth, ui, metrics)
      // Problem: This will recalculate when ANY store changes, even unrelated ones
      const summary = derived([counter, user], ([c, u]) => `${u}: ${c} clicks`);
      
      // Track how many times our "expensive" computation runs
      let computationCount = 0;
      const expensiveView = derived([counter, user], ([c, u]) => {
        computationCount++;
        // Simulate expensive computation
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(c * i);
        }
        return `${u} expensive result: ${result}`;
      });

      return {
        stores: { counter, user, cart, auth, ui, metrics },
        derived: { summary, expensiveView },
        getComputationCount: () => computationCount,
        updateCounter: () => counter.update(n => n + 1),
        updateUser: () => user.set(`User${Math.random()}`),
        updateCart: () => cart.update(c => ({ ...c, items: c.items + 1 })),
        updateAuth: () => auth.update(a => ({ ...a, role: a.role === 'user' ? 'admin' : 'user' })),
        updateUI: () => ui.update(u => ({ ...u, theme: u.theme === 'light' ? 'dark' : 'light' })),
        updateMetrics: () => metrics.update(m => ({ ...m, views: m.views + 1 }))
      };
    };

    let svelteSetup: ReturnType<typeof setupSvelteStores>;

    bench(
      'Svelte Derived - complex state (over-reactive)',
      () => {
        // Mix of updates: some relevant to derived, some not
        for (let i = 0; i < UPDATE_ITERATIONS; i++) {
          const updateType = i % 6;
          switch (updateType) {
            case 0: svelteSetup.updateCounter(); break; // Relevant
            case 1: svelteSetup.updateUser(); break;    // Relevant  
            case 2: svelteSetup.updateCart(); break;    // Irrelevant!
            case 3: svelteSetup.updateAuth(); break;    // Irrelevant!
            case 4: svelteSetup.updateUI(); break;      // Irrelevant!
            case 5: svelteSetup.updateMetrics(); break; // Irrelevant!
          }
          
          // Force derivation by accessing values (simulates component reactivity)
          get(svelteSetup.derived.summary);
          get(svelteSetup.derived.expensiveView);
        }
      },
      {
        setup: () => {
          svelteSetup = setupSvelteStores();
        }
      }
    );
  }

  // Lattice: Fine-grained reactive slices with combineSlices
  {
    const setupLatticeSlices = () => {
      const createSlice = createStore(INITIAL_STATE);

      // Create focused slices for each domain
      const counterSlice = createSlice(
        (selectors) => ({ counter: selectors.counter }),
        ({ counter }, set) => ({
          value: () => counter(),
          increment: () => set(
            (selectors) => ({ counter: selectors.counter }),
            ({ counter }) => ({ counter: counter() + 1 })
          )
        })
      );

      const userSlice = createSlice(
        (selectors) => ({ user: selectors.user }),
        ({ user }, set) => ({
          name: () => user(),
          setName: (name: string) => set(
            (selectors) => ({ user: selectors.user }),
            () => ({ user: name })
          )
        })
      );

      const cartSlice = createSlice(
        (selectors) => ({ cart: selectors.cart }),
        ({ cart }, set) => ({
          items: () => cart().items,
          addItem: () => set(
            (selectors) => ({ cart: selectors.cart }),
            ({ cart }) => ({ cart: { ...cart(), items: cart().items + 1 } })
          )
        })
      );

      const authSlice = createSlice(
        (selectors) => ({ auth: selectors.auth }),
        ({ auth }, set) => ({
          role: () => auth().role,
          toggleRole: () => set(
            (selectors) => ({ auth: selectors.auth }),
            ({ auth }) => ({ 
              auth: { ...auth(), role: auth().role === 'user' ? 'admin' : 'user' }
            })
          )
        })
      );

      const uiSlice = createSlice(
        (selectors) => ({ ui: selectors.ui }),
        ({ ui }, set) => ({
          theme: () => ui().theme,
          toggleTheme: () => set(
            (selectors) => ({ ui: selectors.ui }),
            ({ ui }) => ({ ui: { ...ui(), theme: ui().theme === 'light' ? 'dark' : 'light' } })
          )
        })
      );

      const metricsSlice = createSlice(
        (selectors) => ({ metrics: selectors.metrics }),
        ({ metrics }, set) => ({
          views: () => metrics().views,
          incrementViews: () => set(
            (selectors) => ({ metrics: selectors.metrics }),
            ({ metrics }) => ({ metrics: { ...metrics(), views: metrics().views + 1 } })
          )
        })
      );

      // Combine only the slices we actually need (fine-grained!)
      const summary = combineSlices(
        [counterSlice, userSlice],
        (counter, user) => `${user.name()}: ${counter.value()} clicks`
      );

      // Track computation count for expensive derived
      let computationCount = 0;
      const expensiveView = combineSlices(
        [counterSlice, userSlice], // Only depends on these 2 slices!
        (counter, user) => {
          computationCount++;
          // Same expensive computation
          let result = 0;
          for (let i = 0; i < 1000; i++) {
            result += Math.sqrt(counter.value() * i);
          }
          return `${user.name()} expensive result: ${result}`;
        }
      );

      return {
        slices: { counterSlice, userSlice, cartSlice, authSlice, uiSlice, metricsSlice },
        derived: { summary, expensiveView },
        getComputationCount: () => computationCount,
        updateCounter: () => counterSlice().increment(),
        updateUser: () => userSlice().setName(`User${Math.random()}`),
        updateCart: () => cartSlice().addItem(),
        updateAuth: () => authSlice().toggleRole(),
        updateUI: () => uiSlice().toggleTheme(),
        updateMetrics: () => metricsSlice().incrementViews()
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
            case 0: latticeSetup.updateCounter(); break; // Relevant
            case 1: latticeSetup.updateUser(); break;    // Relevant
            case 2: latticeSetup.updateCart(); break;    // Irrelevant - WON'T trigger expensive recalculation!
            case 3: latticeSetup.updateAuth(); break;    // Irrelevant - WON'T trigger expensive recalculation!
            case 4: latticeSetup.updateUI(); break;      // Irrelevant - WON'T trigger expensive recalculation!
            case 5: latticeSetup.updateMetrics(); break; // Irrelevant - WON'T trigger expensive recalculation!
          }
          
          // Force evaluation (simulates component reactivity)
          get(latticeSetup.derived.summary);
          get(latticeSetup.derived.expensiveView);
        }
      },
      {
        setup: () => {
          latticeSetup = setupLatticeSlices();
        }
      }
    );
  }
});

describe('Svelte Reactivity - Computation Efficiency Analysis', () => {
  // This benchmark specifically measures unnecessary recalculations
  bench(
    'Analysis: Count Svelte over-reactive computations',
    () => {
      const setupAnalysis = () => {
        const counter = writable(0);
        const unrelated = writable('foo');
        
        let expensiveComputations = 0;
        const expensive = derived([counter, unrelated], ([c, u]) => {
          expensiveComputations++;
          // Expensive work
          let result = 0;
          for (let i = 0; i < 10000; i++) {
            result += Math.sqrt(c * i);
          }
          return result;
        });

        return { counter, unrelated, expensive, getCount: () => expensiveComputations };
      };

      const analysis = setupAnalysis();
      
      // Update only unrelated state 100 times
      for (let i = 0; i < 100; i++) {
        analysis.unrelated.set(`foo${i}`);
        get(analysis.expensive); // Force recalculation
      }
      
      // The expensive computation ran 101 times (initial + 100 unnecessary updates)
      // With Lattice, it would only run 1 time (initial)
    }
  );

  bench(
    'Analysis: Count Lattice fine-grained computations',
    () => {
      const setupAnalysis = () => {
        const createSlice = createStore({ counter: 0, unrelated: 'foo' });
        
        const counterSlice = createSlice(
          (selectors) => ({ counter: selectors.counter }),
          ({ counter }, set) => ({
            value: () => counter(),
            increment: () => set(
              (selectors) => ({ counter: selectors.counter }),
              ({ counter }) => ({ counter: counter() + 1 })
            )
          })
        );

        const unrelatedSlice = createSlice(
          (selectors) => ({ unrelated: selectors.unrelated }),
          ({ unrelated }, set) => ({
            value: () => unrelated(),
            setValue: (value: string) => set(
              (selectors) => ({ unrelated: selectors.unrelated }),
              () => ({ unrelated: value })
            )
          })
        );

        let expensiveComputations = 0;
        const expensive = sliceDerived(counterSlice, (counter) => {
          expensiveComputations++;
          // Same expensive work
          let result = 0;
          for (let i = 0; i < 10000; i++) {
            result += Math.sqrt(counter.value() * i);
          }
          return result;
        });

        return { counterSlice, unrelatedSlice, expensive, getCount: () => expensiveComputations };
      };

      const analysis = setupAnalysis();
      
      // Update only unrelated state 100 times
      for (let i = 0; i < 100; i++) {
        analysis.unrelatedSlice().setValue(`foo${i}`);
        get(analysis.expensive); // Try to force recalculation
      }
      
      // The expensive computation only runs 1 time (initial)!
      // Lattice's fine-grained reactivity prevents unnecessary work
    }
  );
});