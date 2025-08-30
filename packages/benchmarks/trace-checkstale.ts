/**
 * Trace to verify checkStale() behavior
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

const ctx = createDefaultContext();

// Intercept checkStale and isStale calls
let checkStaleCount = 0;
let isStaleCount = 0;

const originalCheckStale = ctx.graph.checkStale;
ctx.graph.checkStale = function(node: any) {
  checkStaleCount++;
  console.log(`→ checkStale() call #${checkStaleCount}`);
  return originalCheckStale.call(this, node);
};

const originalIsStale = ctx.graph.isStale;
ctx.graph.isStale = function(node: any) {
  isStaleCount++;
  console.log(`  → isStale() call #${isStaleCount}`);
  return originalIsStale.call(this, node);
};

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, ctx);

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const computed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

console.log('=== Creating chain: s → c1 → c2 → c3 ===\n');

const s = signal(1);
const c1 = computed(() => s() + 1);
const c2 = computed(() => c1() + 1);
const c3 = computed(() => c2() + 1);

console.log('Initial read:');
console.log(`c3 = ${c3()}\n`);

// Reset counters
checkStaleCount = 0;
isStaleCount = 0;

console.log('After signal update:');
s(10);
console.log(`c3 = ${c3()}\n`);

console.log('=== Analysis ===');
console.log(`checkStale() calls: ${checkStaleCount}`);
console.log(`isStale() calls: ${isStaleCount}`);
console.log('\nThe problem: checkStale calls isStale, which does the traversal.');
console.log('But then c3 still needs to read c2, which also calls checkStale!');