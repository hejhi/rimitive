/**
 * Test to count traversals in isStale
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Track traversals
let traversalCount = 0;
let isStaleCallCount = 0;

// Monkey-patch to count calls
const originalContext = createDefaultContext();
const patchedContext = {
  ...originalContext,
  graph: {
    ...originalContext.graph,
    isStale: (node: any) => {
      isStaleCallCount++;
      const result = originalContext.graph.isStale(node);
      
      // Count how many times we traverse into dependencies
      // This is a simplified count - actual traversal is more complex
      traversalCount++;
      
      return result;
    }
  }
};

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, patchedContext);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

// Test different chain depths
const depths = [5, 10, 20, 30, 40, 50];

console.log('Chain Depth | isStale Calls | Traversals | Ratio');
console.log('------------|---------------|------------|------');

for (const depth of depths) {
  // Reset counters
  traversalCount = 0;
  isStaleCallCount = 0;
  
  // Create chain
  const source = latticeSignal(0);
  let last: (() => number) = source;
  
  for (let i = 0; i < depth; i++) {
    const prev = last;
    last = latticeComputed(() => prev() + 1);
  }
  
  const final = last;
  
  // Initial read to establish dependencies
  final();
  
  // Reset counters for the actual test
  traversalCount = 0;
  isStaleCallCount = 0;
  
  // Update source
  source(1);
  
  // Read final (this triggers isStale checks)
  final();
  
  const ratio = (isStaleCallCount / depth).toFixed(2);
  console.log(`${depth.toString().padEnd(11)} | ${isStaleCallCount.toString().padEnd(13)} | ${traversalCount.toString().padEnd(10)} | ${ratio}`);
}

console.log('\nObservation:');
console.log('If isStale calls = depth, it\'s O(n) - good!');
console.log('If isStale calls > depth, it\'s worse than O(n) - bad!');
console.log('The ratio shows how many times each computed is checked on average.');