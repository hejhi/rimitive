/**
 * Demonstrates redundant isStale() calls in Lattice's deep chain
 * This shows exactly where the performance issue occurs
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Create Lattice API instance with tracing
const ctx = createDefaultContext();

// Intercept isStale calls to trace them
let isStaleCallStack: string[] = [];
let isStaleCallCount = 0;
const originalIsStale = ctx.graph.isStale;
ctx.graph.isStale = function(node: any) {
  const caller = new Error().stack?.split('\n')[2] || 'unknown';
  isStaleCallCount++;
  
  // Track the call stack depth
  const indent = '  '.repeat(isStaleCallStack.length);
  console.log(`${indent}→ isStale() call #${isStaleCallCount} from: ${caller.trim()}`);
  
  isStaleCallStack.push(`call #${isStaleCallCount}`);
  const result = originalIsStale.call(this, node);
  isStaleCallStack.pop();
  
  if (isStaleCallStack.length === 0) {
    console.log(`${indent}← isStale() returned: ${result}`);
  }
  
  return result;
};

// Also trace recompute calls
let recomputeCount: Record<string, number> = {};
function traceComputed<T>(name: string, compute: () => T) {
  recomputeCount[name] = 0;
  return () => {
    recomputeCount[name]++;
    console.log(`    [RECOMPUTE] ${name} (call #${recomputeCount[name]})`);
    return compute();
  };
}

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, ctx);

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const computed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

console.log('=== Creating a chain of 4 computeds ===\n');

// Create a simple chain: signal -> c1 -> c2 -> c3 -> c4
const s = signal(1);
const c1 = computed(traceComputed('c1', () => s() + 1));
const c2 = computed(traceComputed('c2', () => c1() + 1));
const c3 = computed(traceComputed('c3', () => c2() + 1));
const c4 = computed(traceComputed('c4', () => c3() + 1));

console.log('=== Initial read to establish dependencies ===\n');
console.log(`c4 value: ${c4()}\n`);

// Reset counters
isStaleCallCount = 0;
recomputeCount = {};

console.log('=== Now update signal and read c4 ===\n');
console.log('This should show redundant isStale() calls:\n');

s(10);
console.log(`\nReading c4 after signal update...`);
const result = c4();
console.log(`\nc4 final value: ${result}`);

console.log('\n=== Analysis ===');
console.log(`Total isStale() calls: ${isStaleCallCount}`);
console.log(`Recompute counts:`, recomputeCount);

console.log('\n=== The Problem ===');
console.log('Expected: 1 isStale() call (from c4)');
console.log(`Actual: ${isStaleCallCount} isStale() calls`);
console.log('\nWhy? During c3\'s recomputation, it reads c2, which triggers');
console.log('another staleness check even though c2 was already updated');
console.log('by the parent isStale() traversal.');