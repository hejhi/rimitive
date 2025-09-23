import { bench, run } from 'mitata';
import { createApi } from './src/suites/lattice/helpers/signal-computed';

// Track what gets created
let apiCreated = 0;
let nodesCreated = 0;
const allNodes: any[] = [];

bench('Lattice Pattern from computed-diamond-simple', function* () {
  // API created ONCE outside yield - shared across all iterations!
  const api = createApi();
  apiCreated++;

  const signal = api.signal;
  const computed = api.computed;

  yield () => {
    // But nodes are created INSIDE yield - runs MANY times!
    nodesCreated++;

    const source = signal(0);
    const left = computed(() => source() * 2);
    const right = computed(() => source() * 3);
    const bottom = computed(() => left() + right());

    allNodes.push({ source, left, right, bottom });

    // Run the benchmark
    for (let i = 0; i < 100; i++) {
      source(i);
      void bottom();
    }
  };
});

await run({
  min_samples: 12,  // mitata default
  max_samples: 100  // limit for testing
});

console.log(`\n🔴 THE PROBLEM:`);
console.log(`APIs created: ${apiCreated} (shared by all nodes)`);
console.log(`Node sets created: ${nodesCreated} (accumulating in memory)`);
console.log(`Total nodes in memory: ${allNodes.length * 4} nodes`);

// Let's check if nodes can reference each other through the shared API
if (allNodes.length > 1) {
  console.log(`\n🔍 Examining node relationships:`);

  // All nodes share the same graph edge helpers from the single API
  console.log(`All ${allNodes.length} node sets use the SAME:`);
  console.log(`  - trackDependency function`);
  console.log(`  - propagate function`);
  console.log(`  - context object`);
  console.log(`  - graph edge management`);

  console.log(`\nThis means nodes from iteration N can form edges with nodes from iteration N-1!`);
  console.log(`The graph accumulates ALL nodes ever created during benchmarking.`);
}