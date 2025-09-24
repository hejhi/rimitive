// Test to demonstrate the pruning bug identified by expert
import { createSignalAPI } from './packages/signals/dist/api.js';
import { createSignalFactory } from './packages/signals/dist/signal.js';
import { createComputedFactory } from './packages/signals/dist/computed.js';
import { createBaseContext } from './packages/signals/dist/context.js';
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';
import { createGraphTraversal } from './packages/signals/dist/helpers/graph-traversal.js';
import { createPullPropagator } from './packages/signals/dist/helpers/pull-propagator.js';

const createApi = () => {
  const { propagate } = createGraphTraversal();
  const graphEdges = createGraphEdges();
  const { trackDependency } = graphEdges;
  const ctx = createBaseContext();
  const { pullUpdates } = createPullPropagator({ ctx, track: graphEdges.track });

  return createSignalAPI(
    {
      signal: createSignalFactory,
      computed: createComputedFactory,
    },
    {
      ctx,
      trackDependency,
      propagate,
      pullUpdates,
    }
  );
};

console.log('=== TESTING PRUNING BUG HYPOTHESIS ===\n');

const api = createApi();
const { signal, computed } = api;

// Create signals
const A = signal('A');
const B = signal('B');
const C = signal('C');

let condition = true;

// Computed that changes dependencies dynamically
const dynamic = computed(() => {
  const a = A();
  if (condition) {
    const b = B(); // Access B only when condition is true
  }
  const c = C();
  return a + c;
});

console.log('Initial evaluation with dependencies [A, B, C]:');
dynamic(); // Should track A, B, C

// Count initial dependencies
let countDeps = () => {
  let count = 0;
  let dep = dynamic.dependencies;
  const deps = [];
  while (dep) {
    deps.push(dep.producer === A ? 'A' : dep.producer === B ? 'B' : 'C');
    count++;
    dep = dep.nextDependency;
  }
  console.log(`  Dependencies: [${deps.join(', ')}] (count: ${count})`);
  return count;
};

countDeps();

console.log('\nChanging condition to false, should have [A, C] only:');
condition = false;
dynamic(); // Should track A, C only (B is skipped)

const afterCount = countDeps();

if (afterCount > 2) {
  console.log('\n❌ PRUNING BUG CONFIRMED! B was not removed from dependencies!');
  console.log('This proves the expert\'s hypothesis is correct.');
} else {
  console.log('\n✅ Dependencies correctly pruned');
}

// Test the impact over many iterations
console.log('\n--- Testing accumulation over iterations ---');
for (let i = 0; i < 100; i++) {
  condition = i % 2 === 0; // Toggle condition
  dynamic();
}

const finalCount = countDeps();
console.log(`\nFinal dependency count after 100 toggles: ${finalCount}`);
if (finalCount > 3) {
  console.log('❌ Dependencies are accumulating due to pruning bug!');
}