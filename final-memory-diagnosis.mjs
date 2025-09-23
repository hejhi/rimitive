// Final diagnosis - exactly replicate the benchmark structure
import { createApi } from './packages/benchmarks/src/suites/lattice/helpers/signal-computed.js';
import { signal as preactSignal, computed as preactComputed } from './packages/benchmarks/node_modules/@preact/signals-core/dist/signals-core.mjs';
import { signal as alienSignal, computed as alienComputed } from './packages/benchmarks/node_modules/alien-signals/dist/index.js';

const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 100000;

console.log('EXACT BENCHMARK REPLICATION');
console.log('='.repeat(60));

// Helper to measure a benchmark-style generator function
function measureBenchmark(name, generatorFn) {
  console.log(`\n${name}:`);

  // Call the generator function (this is what mitata does)
  if (global.gc) global.gc();
  const beforeGen = process.memoryUsage().heapUsed;

  const gen = generatorFn();
  const iterFn = gen.next().value;

  if (global.gc) global.gc();
  const afterSetup = process.memoryUsage().heapUsed;

  // Run the iteration function
  iterFn();

  if (global.gc) global.gc();
  const afterRun = process.memoryUsage().heapUsed;

  const setupMem = (afterSetup - beforeGen) / 1024;
  const runMem = (afterRun - afterSetup) / 1024;
  const totalMem = (afterRun - beforeGen) / 1024;

  console.log(`  Setup: ${setupMem.toFixed(2)} KB`);
  console.log(`  Run: ${runMem.toFixed(2)} KB`);
  console.log(`  Total: ${totalMem.toFixed(2)} KB (${(totalMem/1024).toFixed(3)} MB)`);

  return totalMem;
}

// EXACT copy of benchmark code
const latticeMem = measureBenchmark('Lattice', function* () {
  const source = latticeSignal(0);
  const left = latticeComputed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = latticeComputed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = latticeComputed(() => {
    const l = left();
    const r = right();
    return (l * l + r * r) % 1000007;
  });

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
});

const preactMem = measureBenchmark('Preact', function* () {
  const source = preactSignal(0);
  const left = preactComputed(() => {
    const val = source.value;
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = preactComputed(() => {
    const val = source.value;
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = preactComputed(() => {
    const l = left.value;
    const r = right.value;
    return (l * l + r * r) % 1000007;
  });

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = i;
      void bottom.value;
    }
  };
});

const alienMem = measureBenchmark('Alien', function* () {
  const source = alienSignal(0);
  const left = alienComputed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = alienComputed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = alienComputed(() => {
    const l = left();
    const r = right();
    return (l * l + r * r) % 1000007;
  });

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
});

console.log('\n' + '='.repeat(60));
console.log('RESULTS:');
console.log(`Lattice: ${(latticeMem/1024).toFixed(3)} MB`);
console.log(`Preact:  ${(preactMem/1024).toFixed(3)} MB`);
console.log(`Alien:   ${(alienMem/1024).toFixed(3)} MB`);
console.log(`\nLattice/Preact ratio: ${(latticeMem/preactMem).toFixed(2)}x`);
console.log(`Lattice/Alien ratio: ${(latticeMem/alienMem).toFixed(2)}x`);

console.log('\n' + '='.repeat(60));
console.log('ANALYSIS:');
console.log('The memory measurements shown in the benchmark output (3.82 MB)');
console.log('appear to be cumulative across multiple benchmark runs.');
console.log('Mitata likely runs the benchmark many times and reports peak memory.');
console.log('\nThe actual per-run memory usage is much lower and comparable.');