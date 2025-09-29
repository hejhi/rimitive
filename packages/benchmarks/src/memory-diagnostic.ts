/**
 * Memory diagnostic to understand 2-field stack retention patterns
 *
 * This script helps investigate why storing `dep: Dependency` in stack
 * causes more memory retention than storing separate node references.
 */

import { createApi } from './suites/lattice/helpers/signal-computed-effect';

const CHAIN_DEPTHS = [10, 50, 100];

function measureMemory(label: string, fn: () => void): number {
  // Force GC before measurement
  if (global.gc) global.gc();

  const before = process.memoryUsage().heapUsed;
  fn();

  // Force GC after to see retained memory
  if (global.gc) global.gc();

  const after = process.memoryUsage().heapUsed;
  const delta = after - before;

  console.log(`${label}: ${(delta / 1024 / 1024).toFixed(2)} MB (${delta.toLocaleString()} bytes)`);
  return delta;
}

console.log('=== Memory Diagnostic: 2-field Stack ===\n');
console.log('Testing hypothesis: Dependency objects keep entire graph reachable\n');

const latticeAPI = createApi();
const { signal, computed } = latticeAPI;

for (const DEPTH of CHAIN_DEPTHS) {
  console.log(`\n--- Chain depth: ${DEPTH} ---`);

  let chainMemory = 0;
  let source: any;
  let last: any;

  chainMemory = measureMemory('  1. Create chain', () => {
    source = signal(0);
    last = source;

    for (let i = 0; i < DEPTH; i++) {
      const prev = last;
      last = computed(() => prev() + 1);
    }
  });

  const warmupMemory = measureMemory('  2. First access (warmup)', () => {
    void last();
  });

  const updateMemory = measureMemory('  3. Update + access', () => {
    source(1);
    void last();
  });

  const secondUpdateMemory = measureMemory('  4. Second update', () => {
    source(2);
    void last();
  });

  // Try to understand per-node overhead
  const totalNodes = DEPTH + 1; // 1 signal + N computed
  const perNodeBytes = chainMemory / totalNodes;

  console.log(`\n  Analysis:`);
  console.log(`    Total nodes: ${totalNodes}`);
  console.log(`    Per-node overhead: ${perNodeBytes.toFixed(0)} bytes`);
  console.log(`    Warmup overhead: ${(warmupMemory / 1024).toFixed(2)} KB`);
  console.log(`    Update overhead: ${(updateMemory / 1024).toFixed(2)} KB`);

  // Release references
  source = null;
  last = null;
  if (global.gc) global.gc();
}

console.log('\n=== Expected per-node overhead ===');
console.log('DerivedNode: ~80 bytes (8 fields × 10 bytes avg)');
console.log('Dependency: ~80 bytes (8 fields × 10 bytes avg)');
console.log('Expected per edge: ~160 bytes');
console.log('\nIf we\'re seeing > 200 bytes/node, something is being retained.');