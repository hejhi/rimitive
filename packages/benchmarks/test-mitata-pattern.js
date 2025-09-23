#!/usr/bin/env node

// Test that mimics the exact mitata benchmark pattern to understand heap measurements

import { createApi } from './src/suites/lattice/helpers/signal-computed.ts';
import { signal as preactSignal, computed as preactComputed } from '@preact/signals-core';

// Single API instance created once (like in the benchmark)
const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;

const ITERATIONS = 100000;

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

console.log('Testing mitata-like benchmark pattern...\n');

// Simulate what mitata does with generator functions
async function simulateMitataRun(name, generatorFn) {
  // Call the generator
  const gen = generatorFn();

  // Get the setup result (before yield)
  const setupResult = gen.next();
  const benchmarkFn = setupResult.value;

  // Force GC before measuring
  if (global.gc) global.gc();

  // Measure heap BEFORE running the benchmark
  const heapBefore = process.memoryUsage().heapUsed;

  // Run the benchmark function (what comes after yield)
  benchmarkFn();

  // Measure heap AFTER running
  if (global.gc) global.gc();
  const heapAfter = process.memoryUsage().heapUsed;

  const heapDelta = heapAfter - heapBefore;

  console.log(`${name}:`);
  console.log(`  Heap before: ${formatBytes(heapBefore)}`);
  console.log(`  Heap after:  ${formatBytes(heapAfter)}`);
  console.log(`  Delta:       ${formatBytes(heapDelta)}\n`);
}

// Run Lattice benchmark (reusing single API instance)
console.log('=== First Run ===\n');
await simulateMitataRun('Lattice', function* () {
  const source = latticeSignal(0);
  const left = latticeComputed(() => source() * 2);
  const right = latticeComputed(() => source() * 3);
  const bottom = latticeComputed(() => left() + right());

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
});

// Run Preact benchmark
await simulateMitataRun('Preact', function* () {
  const source = preactSignal(0);
  const left = preactComputed(() => source.value * 2);
  const right = preactComputed(() => source.value * 3);
  const bottom = preactComputed(() => left.value + right.value);

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = i;
      void bottom.value;
    }
  };
});

// Run Lattice AGAIN to see if memory accumulates
console.log('=== Second Run (checking accumulation) ===\n');
await simulateMitataRun('Lattice (2nd)', function* () {
  const source = latticeSignal(0);
  const left = latticeComputed(() => source() * 2);
  const right = latticeComputed(() => source() * 3);
  const bottom = latticeComputed(() => left() + right());

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
});

// Run Preact AGAIN
await simulateMitataRun('Preact (2nd)', function* () {
  const source = preactSignal(0);
  const left = preactComputed(() => source.value * 2);
  const right = preactComputed(() => source.value * 3);
  const bottom = preactComputed(() => left.value + right.value);

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = i;
      void bottom.value;
    }
  };
});

// Now test with fresh Lattice API each time
console.log('=== Fresh API Each Time ===\n');
await simulateMitataRun('Lattice (fresh API)', function* () {
  const freshAPI = createApi();
  const source = freshAPI.signal(0);
  const left = freshAPI.computed(() => source() * 2);
  const right = freshAPI.computed(() => source() * 3);
  const bottom = freshAPI.computed(() => left() + right());

  yield () => {
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void bottom();
    }
  };
});