// Simple benchmark to test subscription overhead
import { createStore as createZustandStore } from 'zustand/vanilla';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Test configuration
const ITERATIONS = 10000;
const SUBSCRIPTION_COUNT = 100;

// Helper to measure time
function measure(name, fn) {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  return end - start;
}

// Test 1: Raw Zustand subscriptions
console.log('\n=== Raw Zustand ===');
const rawStore = createZustandStore(() => ({ count: 0 }));
const rawUnsubscribers = [];

measure('Add 100 subscriptions', () => {
  for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
    rawUnsubscribers.push(rawStore.subscribe(() => {}));
  }
});

measure('Trigger 10k updates', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    rawStore.setState({ count: i });
  }
});

measure('Cleanup subscriptions', () => {
  rawUnsubscribers.forEach(unsub => unsub());
});

// Test 2: Lattice-wrapped Zustand
console.log('\n=== Lattice + Zustand ===');
const createComponent = (createStore) => {
  const createSlice = createStore({ count: 0 });
  const counter = createSlice(({ get, set }) => ({
    increment: () => set({ count: get().count + 1 }),
    getCount: () => get().count,
  }));
  return { counter };
};

const latticeStore = createZustandAdapter(createComponent);
const latticeUnsubscribers = [];

measure('Add 100 subscriptions', () => {
  for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
    latticeUnsubscribers.push(latticeStore.subscribe(() => {}));
  }
});

measure('Trigger 10k updates', () => {
  for (let i = 0; i < ITERATIONS; i++) {
    latticeStore.counter.increment();
  }
});

measure('Cleanup subscriptions', () => {
  latticeUnsubscribers.forEach(unsub => unsub());
});

// Test 3: Check memory usage
console.log('\n=== Memory Usage ===');
console.log('Memory used:', process.memoryUsage());