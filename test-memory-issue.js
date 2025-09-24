// Test to verify dependency accumulation in computed-diamond pattern
import { createApi } from './packages/benchmarks/src/suites/lattice/helpers/signal-computed.js';

const api = createApi();
const { signal, computed } = api;

// Track dependency creation count
let dependencyCount = 0;
const originalTrackDependency = api._internal?.trackDependency;

// Wrap trackDependency to count calls
if (api._internal && api._internal.trackDependency) {
  api._internal.trackDependency = function(producer, consumer) {
    dependencyCount++;
    return originalTrackDependency.call(this, producer, consumer);
  };
}

// Create diamond pattern
const source = signal(0);
const left = computed(() => source() * 2);
const right = computed(() => source() * 3);
const bottom = computed(() => left() + right());

console.log('Initial setup complete');
console.log('Dependencies created:', dependencyCount);

// Reset counter
const setupCount = dependencyCount;
dependencyCount = 0;

// Run 100 iterations like the benchmark
for (let i = 1; i <= 100; i++) {
  source(i);
  bottom(); // Trigger evaluation

  if (i % 10 === 0) {
    console.log(`After ${i} iterations: ${dependencyCount} new dependencies`);
  }
}

console.log('\n=== RESULTS ===');
console.log('Setup dependencies:', setupCount);
console.log('Dependencies created during 100 iterations:', dependencyCount);
console.log('Average per iteration:', (dependencyCount / 100).toFixed(2));

if (dependencyCount > 0) {
  console.log('\n❌ MEMORY LEAK CONFIRMED: Dependencies are being created on each iteration!');
} else {
  console.log('\n✅ No dependency accumulation detected');
}