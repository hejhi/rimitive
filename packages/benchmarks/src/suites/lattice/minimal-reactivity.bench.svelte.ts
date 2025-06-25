/**
 * @fileoverview MINIMAL benchmark to verify reactivity works correctly
 *
 * IMPORTANT: In the benchmark environment, Svelte runes behave differently
 * than in components. Specifically:
 * - $derived.by() recomputes on EVERY access (not lazy)
 * - $effect and $effect.root are not available
 * - This is expected behavior outside of component context
 *
 * This benchmark tests computation performance in this specific context,
 * NOT true Svelte component reactivity.
 */

import { describe, bench } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

const ITERATIONS = 100;

// Quick verification test to show behavior
if ((globalThis as any).DEBUG_REACTIVITY) {
  console.log('\n=== REACTIVITY VERIFICATION ===');
  let testComputations = 0;
  const testState = $state({ count: 0 });
  const testDerived = $derived.by(() => {
    testComputations++;
    return testState.count * 2;
  });

  // Access without state change
  void testDerived;
  void testDerived;
  void testDerived;
  console.log(
    `3 accesses without state change: ${testComputations} computations`
  );

  // Change state and access
  testState.count = 1;
  void testDerived;
  console.log(
    `After state change and 1 access: ${testComputations} computations`
  );
  console.log('=== END VERIFICATION ===\n');
}

describe('Reactivity Benchmark - Non-Component Context', () => {
  // BASELINE: Plain JavaScript (no reactivity)
  bench('Plain JS - no reactivity baseline', () => {
    let state = { count: 0 };
    let computations = 0;

    const getDoubled = () => {
      computations++;
      return state.count * 2;
    };

    for (let i = 0; i < ITERATIONS; i++) {
      state.count = i;
      const doubled = getDoubled();
      void doubled;
    }

    if (computations !== ITERATIONS) {
      throw new Error(
        `Expected ${ITERATIONS} computations, got ${computations}`
      );
    }
  });

  // TEST 1: Svelte Runes in benchmark context
  bench('Svelte Runes - minimal counter', () => {
    let computations = 0;

    const state = $state({ count: 0 });

    // In benchmark context, this will compute on every access
    const doubled = $derived.by(() => {
      computations++;
      return state.count * 2;
    });

    // Update state and access derived
    for (let i = 0; i < ITERATIONS; i++) {
      state.count = i;
      const value = doubled;
      void value;
    }

    // In benchmark context, we expect one computation per access
    if (computations !== ITERATIONS) {
      console.warn(
        `[SVELTE] Expected ${ITERATIONS} computations, got ${computations}`
      );
    }
  });

  // TEST 2: Lattice Runtime
  bench('Lattice Runtime - minimal counter', () => {
    let computations = 0;

    const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));

    const counterSlice = createSlice(select('count'), ({ count }, set) => ({
      value: () => count(),
      doubled: () => {
        computations++;
        return count() * 2;
      },
      setCount: (n: number) => set(() => ({ count: n })),
    }));

    // Update state and access derived
    for (let i = 0; i < ITERATIONS; i++) {
      counterSlice().setCount(i);
      const value = counterSlice().doubled();
      void value;
    }

    if (computations !== ITERATIONS) {
      console.warn(
        `[LATTICE] Expected ${ITERATIONS} computations, got ${computations}`
      );
    }
  });

  // TEST 3: Svelte Runes with simple $derived expression
  bench('Svelte Runes - simple $derived expression', () => {
    const state = $state({ count: 0 });

    // Simple expression might be optimized differently
    const doubled = $derived(state.count * 2);

    // Update state and access derived
    for (let i = 0; i < ITERATIONS; i++) {
      state.count = i;
      const value = doubled;
      void value;
    }
  });
});

describe('Update Performance Tests', () => {
  // Test state update performance without derived values
  bench('Svelte - state updates only', () => {
    const state = $state({ count: 0 });

    for (let i = 0; i < ITERATIONS; i++) {
      state.count = i;
    }
  });

  bench('Lattice - state updates only', () => {
    const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));

    const counterSlice = createSlice(select('count'), (_, set) => ({
      setCount: (n: number) => set(() => ({ count: n })),
    }));

    for (let i = 0; i < ITERATIONS; i++) {
      counterSlice().setCount(i);
    }
  });
});

describe('Complex State Updates', () => {
  const COMPLEX_STATE = {
    user: { name: 'Test', age: 25 },
    settings: { theme: 'dark', notifications: true },
    data: { items: [1, 2, 3], total: 6 },
  };

  bench('Svelte - nested state updates', () => {
    const state = $state(structuredClone(COMPLEX_STATE));

    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 3 === 0) {
        state.user.age++;
      } else if (i % 3 === 1) {
        state.settings.theme =
          state.settings.theme === 'dark' ? 'light' : 'dark';
      } else {
        state.data.total = state.data.items.reduce((a, b) => a + b, 0);
      }
    }
  });

  bench('Lattice - nested state updates', () => {
    const createSlice = createLatticeStore(
      vanillaAdapter(structuredClone(COMPLEX_STATE))
    );

    const userSlice = createSlice(select('user'), (_, set) => ({
      incrementAge: () =>
        set(({ user }) => ({
          user: { ...user(), age: user().age + 1 },
        })),
    }));

    const settingsSlice = createSlice(select('settings'), (_, set) => ({
      toggleTheme: () =>
        set(({ settings }) => ({
          settings: {
            ...settings(),
            theme: settings().theme === 'dark' ? 'light' : 'dark',
          },
        })),
    }));

    const dataSlice = createSlice(select('data'), (_, set) => ({
      updateTotal: () =>
        set(({ data }) => ({
          data: {
            ...data(),
            total: data().items.reduce((a, b) => a + b, 0),
          },
        })),
    }));

    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 3 === 0) {
        userSlice().incrementAge();
      } else if (i % 3 === 1) {
        settingsSlice().toggleTheme();
      } else {
        dataSlice().updateTotal();
      }
    }
  });
});
