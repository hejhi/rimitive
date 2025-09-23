import { bench, run } from 'mitata';
import { createApi as createLatticeApi } from './src/suites/lattice/helpers/signal-computed-effect';
import { signal as preactSignal, computed as preactComputed, effect as preactEffect } from '@preact/signals-core';

console.log('🔍 VERIFYING THE MEMORY ACCUMULATION ISSUE:\n');

// Count nodes created
let latticeNodesCreated = 0;
let preactNodesCreated = 0;

bench('Lattice - API outside, nodes inside yield', function* () {
  // This is the problematic pattern
  const api = createLatticeApi();
  const signal = api.signal;
  const computed = api.computed;
  const effect = api.effect;

  yield () => {
    // Nodes created here accumulate!
    latticeNodesCreated++;
    const source = signal(0);
    const comp = computed(() => source() * 2);
    const eff = effect(() => void comp());

    // Run the workload
    for (let i = 0; i < 100; i++) {
      source(i);
    }

    eff(); // dispose
  };
});

bench('Preact - nodes outside yield', function* () {
  // This is the correct pattern
  preactNodesCreated++;
  const source = preactSignal(0);
  const comp = preactComputed(() => source.value * 2);
  const eff = preactEffect(() => void comp.value);

  yield () => {
    // Only the workload runs here
    for (let i = 0; i < 100; i++) {
      source.value = i;
    }
  };

  eff(); // dispose
});

// Also test if moving Lattice nodes outside helps
bench('Lattice - nodes outside yield (fixed pattern)', function* () {
  // Create a NEW API for each benchmark to avoid accumulation
  const api = createLatticeApi();
  const signal = api.signal;
  const computed = api.computed;
  const effect = api.effect;

  // Now create nodes OUTSIDE yield, like Preact does
  const source = signal(0);
  const comp = computed(() => source() * 2);
  const eff = effect(() => void comp());

  yield () => {
    // Only the workload runs here
    for (let i = 0; i < 100; i++) {
      source(i);
    }
  };

  eff(); // dispose
});

await run({
  min_samples: 100,
  max_samples: 200
});

console.log('\n📊 RESULTS:');
console.log(`Lattice nodes created (problematic pattern): ${latticeNodesCreated}`);
console.log(`Preact nodes created (correct pattern): ${preactNodesCreated}`);

console.log('\n💡 EXPLANATION:');
if (latticeNodesCreated > 100) {
  console.log(`✅ CONFIRMED: Lattice created ${latticeNodesCreated} node sets!`);
  console.log('   Each mitata sample iteration created NEW nodes.');
  console.log('   All nodes share the SAME API/context/helpers.');
  console.log('   Result: Massive memory accumulation!\n');

  console.log('🔴 THE ROOT CAUSE:');
  console.log('   1. Benchmarks create API outside yield (once)');
  console.log('   2. But create nodes INSIDE yield (many times)');
  console.log('   3. All nodes use the same shared graph helpers');
  console.log('   4. Nodes accumulate in the shared graph');
  console.log('   5. Memory grows linearly with sample count');
} else {
  console.log('❌ Issue not reproduced - check test setup');
}