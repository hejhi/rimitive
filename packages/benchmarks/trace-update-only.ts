/**
 * Trace only the update phase after signal change
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

const ctx = createDefaultContext();

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, ctx);

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const computed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

// Create and initialize chain
const s = signal(1);
const c1 = computed(() => s() + 1);
const c2 = computed(() => c1() + 1);
const c3 = computed(() => c2() + 1);

// Initial read to establish dependencies
c3();

// Now intercept for the update
let checkStaleCount = 0;
let isStaleCount = 0;

const originalCheckStale = ctx.graph.checkStale;
ctx.graph.checkStale = function(node: any) {
  checkStaleCount++;
  const caller = new Error().stack?.split('\n')[2] || '';
  console.log(`→ checkStale() #${checkStaleCount} from: ${caller.includes('computed.js') ? 'computed.update()' : 'other'}`);
  return originalCheckStale.call(this, node);
};

const originalIsStale = ctx.graph.isStale;
ctx.graph.isStale = function(node: any) {
  isStaleCount++;
  console.log(`  → isStale() #${isStaleCount}`);
  return originalIsStale.call(this, node);
};

console.log('=== After signal update (should be INVALIDATED) ===\n');
s(10);

console.log('Reading c3:');
const result = c3();
console.log(`Result: ${result}\n`);

console.log('=== Analysis ===');
console.log(`Total checkStale() calls: ${checkStaleCount}`);
console.log(`Total isStale() calls: ${isStaleCount}`);

if (checkStaleCount === 1) {
  console.log('✅ SUCCESS: Single checkStale call as expected!');
} else {
  console.log(`❌ PROBLEM: Expected 1 checkStale call, got ${checkStaleCount}`);
  console.log('This means nested computeds are still calling checkStale during recomputation');
}