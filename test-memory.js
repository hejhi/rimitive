// Test memory usage comparison between Lattice and Preact signals

import { createApi } from './packages/benchmarks/src/suites/lattice/helpers/signal-computed.js';
import { signal as preactSignal, computed as preactComputed } from '@preact/signals-core';

const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

function measureMemory(name, setupFn) {
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage();

  const objects = setupFn();

  if (global.gc) global.gc();
  const memAfter = process.memoryUsage();

  const heapUsed = memAfter.heapUsed - memBefore.heapUsed;
  const external = memAfter.external - memBefore.external;
  const rss = memAfter.rss - memBefore.rss;

  console.log(`${name}:`);
  console.log(`  Heap Used: ${(heapUsed / 1024).toFixed(2)} KB`);
  console.log(`  External: ${(external / 1024).toFixed(2)} KB`);
  console.log(`  RSS: ${(rss / 1024).toFixed(2)} KB`);
  console.log(`  Total: ${((heapUsed + external) / 1024).toFixed(2)} KB`);
  console.log('');

  return objects;
}

console.log('Creating a single diamond dependency graph:\n');

// Test Lattice
const latticeObjs = measureMemory('Lattice', () => {
  const source = latticeSignal(0);
  const left = latticeComputed(() => source() * 2);
  const right = latticeComputed(() => source() * 3);
  const bottom = latticeComputed(() => left() + right());

  // Force evaluation to establish dependencies
  bottom();

  return { source, left, right, bottom };
});

// Test Preact
const preactObjs = measureMemory('Preact', () => {
  const source = preactSignal(0);
  const left = preactComputed(() => source.value * 2);
  const right = preactComputed(() => source.value * 3);
  const bottom = preactComputed(() => left.value + right.value);

  // Force evaluation to establish dependencies
  bottom.value;

  return { source, left, right, bottom };
});

// Create many signals to see the pattern
console.log('\nCreating 1000 independent signals:\n');

measureMemory('Lattice - 1000 signals', () => {
  const signals = [];
  for (let i = 0; i < 1000; i++) {
    signals.push(latticeSignal(i));
  }
  return signals;
});

measureMemory('Preact - 1000 signals', () => {
  const signals = [];
  for (let i = 0; i < 1000; i++) {
    signals.push(preactSignal(i));
  }
  return signals;
});

// Test deep diamond dependency
console.log('\nCreating diamond with 100k iterations:\n');

measureMemory('Lattice - 100k iterations', () => {
  const source = latticeSignal(0);
  const left = latticeComputed(() => source() * 2);
  const right = latticeComputed(() => source() * 3);
  const bottom = latticeComputed(() => left() + right());

  for (let i = 0; i < 100000; i++) {
    source(i);
    bottom();
  }

  return { source, left, right, bottom };
});

measureMemory('Preact - 100k iterations', () => {
  const source = preactSignal(0);
  const left = preactComputed(() => source.value * 2);
  const right = preactComputed(() => source.value * 3);
  const bottom = preactComputed(() => left.value + right.value);

  for (let i = 0; i < 100000; i++) {
    source.value = i;
    bottom.value;
  }

  return { source, left, right, bottom };
});