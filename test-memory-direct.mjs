// Direct memory test using the built distribution
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
}

const api = createApi();
const { signal, computed } = api;

// Diamond pattern
const source = signal(0);
const left = computed(() => source() * 2);
const right = computed(() => source() * 3);
const bottom = computed(() => left() + right());

// Initial run
bottom();

console.log('Testing dependency accumulation with 100k iterations...\n');

if (global.gc) {
  global.gc();
}
const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Memory before: ${memBefore.toFixed(2)} MB`);

// Run 100k iterations like the benchmark
for (let i = 0; i < 100000; i++) {
  source(i);
  bottom();
}

if (global.gc) {
  global.gc();
}
const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
const memUsed = memAfter - memBefore;

console.log(`Memory after: ${memAfter.toFixed(2)} MB`);
console.log(`Memory used: ${memUsed.toFixed(2)} MB`);

if (memUsed > 1) {
  console.log('\n❌ MEMORY LEAK DETECTED - Fix may not be working!');
} else {
  console.log('\n✅ MEMORY USAGE NORMAL - Fix appears to be working!');
}