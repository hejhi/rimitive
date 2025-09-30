/**
 * Stack retention diagnostic
 *
 * Tests hypothesis: Storing Dependency (with 8 fields, 6 pointers) keeps more
 * objects reachable than storing direct node references.
 *
 * Key insight: Dependency has bidirectional linked-list pointers that form
 * a web of references throughout the dependency graph.
 */

import { createApi } from './suites/lattice/helpers/signal-computed-effect';

// Instrument pullUpdates to track stack depth
let maxStackDepth = 0;
let totalStackPushes = 0;

console.log('=== Stack Retention Analysis ===\n');

const latticeAPI = createApi();
const { signal, computed } = latticeAPI;

// Test 1: Simple chain to understand stack behavior
console.log('Test 1: Chain of 5 nodes');
console.log('Pattern: S -> C1 -> C2 -> C3 -> C4 -> C5\n');

const s = signal(0);
const c1 = computed(() => s() + 1);
const c2 = computed(() => c1() + 1);
const c3 = computed(() => c2() + 1);
const c4 = computed(() => c3() + 1);
const c5 = computed(() => c4() + 1);

console.log('First access (builds dependency graph):');
console.log('  c5() =', c5());

console.log('\nUpdate signal:');
s(1);
console.log('  After update, before pull:');

console.log('\nAccess after update (triggers pull):');
console.log('  c5() =', c5());

// Test 2: Diamond dependency to see stack patterns
console.log('\n\nTest 2: Diamond dependency');
console.log('Pattern:    S');
console.log('           / \\');
console.log('          A   B');
console.log('           \\ /');
console.log('            C\n');

const s2 = signal(0);
const a = computed(() => s2() + 1);
const b = computed(() => s2() + 2);
const c = computed(() => a() + b());

console.log('First access:');
console.log('  c() =', c());

console.log('\nUpdate and re-access:');
s2(1);
console.log('  c() =', c());

// Test 3: Memory measurement with deep chain
console.log('\n\nTest 3: Deep chain memory analysis');

function measureChain(depth: number) {
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  const source = signal(0);
  let last: any = source;

  for (let i = 0; i < depth; i++) {
    const prev = last;
    last = computed(() => prev() + 1);
  }

  // First access to build graph
  void last();

  // Update to trigger stack usage
  source(1);
  void last();

  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  return {
    depth,
    bytes: after - before,
    perNode: (after - before) / (depth + 1),
  };
}

const depths = [10, 25, 50, 100];
console.log('\nDepth | Total Memory | Per-Node | vs Expected');
console.log('------|--------------|----------|-------------');

for (const depth of depths) {
  const result = measureChain(depth);
  const expected = 160; // DerivedNode (80) + Dependency (80)
  const ratio = result.perNode / expected;
  console.log(
    `${String(result.depth).padStart(5)} | ` +
    `${(result.bytes / 1024).toFixed(2).padStart(10)} KB | ` +
    `${result.perNode.toFixed(0).padStart(7)} B | ` +
    `${ratio.toFixed(2)}x`
  );
}

console.log('\nExpected per-node: ~160 bytes (80 DerivedNode + 80 Dependency)');
console.log('If ratio > 2x, indicates excessive retention.\n');

// Test 4: Analyze Dependency object structure
console.log('\nTest 4: Dependency object analysis');
console.log('When we store `dep: Dependency` in stack, it keeps alive:');
console.log('  1. producer: FromNode (the source)');
console.log('  2. consumer: ToNode (the derived node)');
console.log('  3. prevConsumer: Dependency | undefined');
console.log('  4. nextConsumer: Dependency | undefined');
console.log('  5. prevDependency: Dependency | undefined');
console.log('  6. nextDependency: Dependency | undefined');
console.log('  7. version: number');
console.log('\nThe 6 linked-list pointers create a web of references');
console.log('throughout the entire dependency graph.');