import { bench, run } from 'mitata';
import { createApi } from './src/suites/lattice/helpers/signal-computed-effect';

// Track API instances and nodes
const apiInstances: any[] = [];
const allNodes: any[] = [];

bench('Lattice - creates API in generator', function* () {
  // This mimics what happens in computed-diamond-simple.bench.ts
  const api = createApi();
  apiInstances.push(api);

  const signal = api.signal;
  const computed = api.computed;
  const effect = api.effect;

  // Create nodes (outside yield)
  const source = signal(0);
  const left = computed(() => source() * 2);
  const right = computed(() => source() * 3);
  const bottom = computed(() => left() + right());

  // Track effect separately since it has a disposer
  const disposer = effect(() => {
    void bottom();
  });

  allNodes.push({ source, left, right, bottom, disposer });

  yield () => {
    // This runs many times but doesn't create new nodes
    source(Math.random());
    void bottom();
  };

  // Note: disposer is never called in the benchmark!
});

bench('Preact - creates nodes outside generator', function* () {
  // This mimics what Preact benchmarks do
  // Nodes are created here, outside the generator entirely
  // So they're only created once per bench() call

  yield () => {
    // Just runs the benchmark
  };
});

await run({
  min_samples: 5,
  max_samples: 10
});

console.log(`\nMemory Analysis:`);
console.log(`API instances created: ${apiInstances.length}`);
console.log(`Node sets created: ${allNodes.length}`);

// Check if the APIs share context or are isolated
if (apiInstances.length > 1) {
  const firstCtx = apiInstances[0]._ctx;
  const secondCtx = apiInstances[1]._ctx;
  console.log(`APIs share context: ${firstCtx === secondCtx}`);
}

// Check if nodes from different iterations might reference each other
console.log(`\nChecking for cross-references...`);
if (allNodes.length > 1) {
  // The nodes might maintain references through the shared graph edges
  console.log(`Each node set has its own signal/computed/effect instances`);
  console.log(`But they all go through the same API's graph edges helpers!`);
}