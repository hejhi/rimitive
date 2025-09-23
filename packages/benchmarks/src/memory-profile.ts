// Profile memory allocations to see what's actually being created
import { createApi } from './suites/lattice/helpers/signal-computed';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';

// Test 1: Measure single iteration memory for Lattice
console.log('=== LATTICE MEMORY PROFILE ===');
{
  const api = createApi();
  const { signal, computed } = api;

  // Create diamond
  const source = signal(0);
  const left = computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 31 + j) % 1000007;
    }
    return result;
  });
  const right = computed(() => {
    const val = source();
    let result = val;
    for (let j = 0; j < 5; j++) {
      result = (result * 37 + j * 2) % 1000007;
    }
    return result;
  });
  const bottom = computed(() => {
    const l = left();
    const r = right();
    return (l * l + r * r) % 1000007;
  });

  // Measure memory for single update
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  // Single update
  source(1);
  bottom();

  const after = process.memoryUsage().heapUsed;
  console.log(`Single update: ${after - before} bytes`);

  // Measure memory for 100 updates
  if (global.gc) global.gc();
  const before100 = process.memoryUsage().heapUsed;

  for (let i = 0; i < 100; i++) {
    source(i);
    bottom();
  }

  const after100 = process.memoryUsage().heapUsed;
  console.log(`100 updates: ${after100 - before100} bytes (${(after100 - before100) / 100} bytes/update)`);

  // Measure memory for 100,000 updates (like benchmark)
  if (global.gc) global.gc();
  const before100k = process.memoryUsage().heapUsed;

  for (let i = 0; i < 100000; i++) {
    source(i);
    bottom();
  }

  const after100k = process.memoryUsage().heapUsed;
  console.log(`100,000 updates: ${(after100k - before100k) / 1024} KB (${(after100k - before100k) / 100000} bytes/update)`);
}

console.log('\n=== PREACT MEMORY PROFILE ===');
{
  // Create diamond
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

  // Measure memory for single update
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  source.value = 1;
  void bottom.value;

  const after = process.memoryUsage().heapUsed;
  console.log(`Single update: ${after - before} bytes`);

  // Measure memory for 100 updates
  if (global.gc) global.gc();
  const before100 = process.memoryUsage().heapUsed;

  for (let i = 0; i < 100; i++) {
    source.value = i;
    void bottom.value;
  }

  const after100 = process.memoryUsage().heapUsed;
  console.log(`100 updates: ${after100 - before100} bytes (${(after100 - before100) / 100} bytes/update)`);

  // Measure memory for 100,000 updates
  if (global.gc) global.gc();
  const before100k = process.memoryUsage().heapUsed;

  for (let i = 0; i < 100000; i++) {
    source.value = i;
    void bottom.value;
  }

  const after100k = process.memoryUsage().heapUsed;
  console.log(`100,000 updates: ${(after100k - before100k) / 1024} KB (${(after100k - before100k) / 100000} bytes/update)`);
}

console.log('\n=== ALLOCATION DIFFERENCE ===');
console.log('This shows what Lattice allocates that Preact does not');