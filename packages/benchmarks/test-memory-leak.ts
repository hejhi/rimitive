import { createApi } from './src/suites/lattice/helpers/signal-computed-effect';

// Simulate what happens in benchmarks like computed-diamond-simple
const api = createApi();
const signal = api.signal;
const computed = api.computed;
const effect = api.effect;

console.log('🔴 EXACT MEMORY ACCUMULATION MECHANISM:\n');

// Track all nodes created
const allNodes: any[] = [];

// Simulate mitata iterations (simplified)
console.log('Simulating benchmark iterations...\n');

for (let iteration = 0; iteration < 5; iteration++) {
  console.log(`Iteration ${iteration}:`);

  // This is what happens inside yield() in benchmarks
  const source = signal(iteration);
  const left = computed(() => {
    const val = source();
    return val * 2;
  });
  const right = computed(() => {
    const val = source();
    return val * 3;
  });
  const bottom = computed(() => {
    return left() + right();
  });

  // In benchmarks with effects
  let disposer: any;
  if (iteration % 2 === 0) {
    disposer = effect(() => {
      void bottom();
    });
  }

  allNodes.push({ iteration, source, left, right, bottom, disposer });

  // Run the benchmark workload
  source(100 + iteration);
  void bottom();

  console.log(`  Created 1 signal + 3 computed${disposer ? ' + 1 effect' : ''}`);
  console.log(`  These nodes are now part of the SHARED graph`);
}

console.log(`\n📊 MEMORY STATE:`);
console.log(`Total nodes created: ${allNodes.length * 4} (minimum)`);
console.log(`All using the SAME:`);
console.log(`  - api._ctx (GlobalContext)`);
console.log(`  - trackDependency function`);
console.log(`  - propagate function`);
console.log(`  - scheduler (for effects)`);

console.log(`\n🔗 CROSS-ITERATION REFERENCES:`);

// The KEY problem: nodes from different iterations can reference each other!
const crossIterationComputed = computed(() => {
  // This computed can read signals from ALL previous iterations
  let sum = 0;
  for (const nodes of allNodes) {
    sum += nodes.source();
  }
  return sum;
});

console.log(`Created a computed that reads from ALL ${allNodes.length} iterations`);
console.log(`Value: ${crossIterationComputed()}`);
console.log(`This computed now has dependency edges to ALL signal nodes!`);

console.log(`\n⚠️  WHY THIS HAPPENS IN LATTICE:`);
console.log(`1. The API is created ONCE outside the yield`);
console.log(`2. All graph management (edges, tracking) goes through this single API`);
console.log(`3. Nodes from iteration N can form edges with nodes from iteration N-1`);
console.log(`4. The graph accumulates ALL nodes ever created`);
console.log(`5. Disposers are never called in benchmarks`);

console.log(`\n✅ WHY PREACT/ALIEN DON'T HAVE THIS ISSUE:`);
console.log(`1. They use GLOBAL state (not instance-based)`);
console.log(`2. Each node is independent - no shared API instance`);
console.log(`3. When nodes become unreachable, they can be GC'd`);
console.log(`4. No accumulation through shared context/helpers`);