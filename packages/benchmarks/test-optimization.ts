/**
 * Test to verify the optimization is working
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Track allocations
let stackAllocations = 0;
let linearChainHits = 0;

// Monkey-patch to count allocations
const originalContext = createDefaultContext();

// Intercept the pushStack calls
const originalIsStale = originalContext.graph.isStale;
(originalContext.graph as any).isStale = function(node: any) {
  // Patch to track what's happening
  const originalPush = (this: any, stack: any, edge: any, node: any, stale: any) => {
    stackAllocations++;
    return { edge, node, stale, prev: stack };
  };
  
  // Temporarily replace during this call
  const saved = (globalThis as any).__pushStack;
  (globalThis as any).__pushStack = originalPush;
  (globalThis as any).__linearChainHit = () => linearChainHits++;
  
  const result = originalIsStale.call(this, node);
  
  (globalThis as any).__pushStack = saved;
  return result;
};

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, originalContext);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

// Create a 50-level chain
const source = latticeSignal(0);
let last: (() => number) = source;

for (let i = 0; i < 50; i++) {
  const prev = last;
  last = latticeComputed(() => prev() + 1);
}

const final = last;

// Initial read
final();

// Reset counters
stackAllocations = 0;
linearChainHits = 0;

// Update and read
source(1);
const value = final();

console.log('Results:');
console.log(`  Final value: ${value}`);
console.log(`  Stack allocations: ${stackAllocations}`);
console.log(`  Linear chain optimizations: ${linearChainHits}`);
console.log('\nExpected: 0 stack allocations if optimization is working');