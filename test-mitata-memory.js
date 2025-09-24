#!/usr/bin/env node

/**
 * Test to demonstrate how Mitata measures memory
 *
 * Mitata's memory measurement works by:
 * 1. Taking heap snapshot before benchmark function runs
 * 2. Taking heap snapshot after
 * 3. Recording the difference
 *
 * The issue: When objects are created OUTSIDE the yield (as is standard
 * for benchmarking operations), they persist across iterations but still
 * contribute to memory measurements.
 */

import { bench, run } from 'mitata';

console.log('\n=== MITATA MEMORY MEASUREMENT TEST ===\n');

// Test 1: Objects created outside yield (standard benchmark pattern)
bench('Objects outside yield (standard pattern)', function* () {
  // These objects are created ONCE and reused across all iterations
  const objects = [];
  for (let i = 0; i < 1000; i++) {
    objects.push({ value: i, data: new Array(100).fill(i) });
  }

  // This is what gets benchmarked - just accessing the objects
  yield () => {
    let sum = 0;
    for (const obj of objects) {
      sum += obj.value;
    }
    return sum;
  };
});

// Test 2: Objects created inside yield (measures allocation cost)
bench('Objects inside yield (measures allocation)', function* () {
  yield () => {
    // These objects are created EVERY iteration
    const objects = [];
    for (let i = 0; i < 1000; i++) {
      objects.push({ value: i, data: new Array(100).fill(i) });
    }

    let sum = 0;
    for (const obj of objects) {
      sum += obj.value;
    }
    return sum;
  };
});

// Test 3: No allocations
bench('No allocations (baseline)', function* () {
  yield () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }
    return sum;
  };
});

console.log('Running benchmarks...\n');
await run();

console.log('\n=== EXPLANATION ===');
console.log('The "Objects outside yield" benchmark shows high memory usage because:');
console.log('1. Objects are created before the first measurement');
console.log('2. They persist in memory during all iterations');
console.log('3. Mitata\'s heap measurement captures their presence');
console.log('4. This is why diamond benchmarks show 3.82mb - the graph nodes exist throughout');
console.log('\nThe "Objects inside yield" benchmark shows even higher memory because:');
console.log('1. It\'s actually creating objects every iteration');
console.log('2. This measures allocation overhead, not just presence');
console.log('\nThe "No allocations" benchmark should show minimal memory usage.');