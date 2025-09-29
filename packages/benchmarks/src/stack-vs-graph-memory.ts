/**
 * Separate stack memory from graph memory
 *
 * Tests whether the issue is:
 * 1. Stack frames themselves (should be 16 bytes per frame with 2-field)
 * 2. Graph structure memory (nodes + dependencies)
 * 3. Something else (V8 optimization artifacts, hidden classes, etc.)
 */

import { createApi } from './suites/lattice/helpers/signal-computed-effect';

console.log('=== Stack vs Graph Memory Analysis ===\n');

const latticeAPI = createApi();
const { signal, computed } = latticeAPI;

// First, measure just graph creation WITHOUT any access
console.log('Test 1: Graph creation only (no traversal, no stack)');
console.log('This measures: nodes + dependency edges only\n');

function measureGraphOnly(depth: number) {
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  const source = signal(0);
  let last: any = source;

  for (let i = 0; i < depth; i++) {
    const prev = last;
    last = computed(() => prev() + 1);
  }

  // DON'T access - no traversal, no stack
  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  return after - before;
}

// Then measure with first access (builds dependency tracking)
console.log('Test 2: Graph + first access (builds tracking, uses stack)');
console.log('This measures: nodes + edges + dependency tracking overhead\n');

function measureGraphWithAccess(depth: number) {
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  const source = signal(0);
  let last: any = source;

  for (let i = 0; i < depth; i++) {
    const prev = last;
    last = computed(() => prev() + 1);
  }

  // First access - triggers pull, builds dependency graph
  void last();

  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  return after - before;
}

// Then measure update + access (exercises stack)
console.log('Test 3: Update + access (pure stack exercise)');
console.log('This measures: stack allocation during pull traversal\n');

function measureStackUsage(depth: number) {
  const source = signal(0);
  let last: any = source;

  for (let i = 0; i < depth; i++) {
    const prev = last;
    last = computed(() => prev() + 1);
  }

  // Build graph first
  void last();

  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  // Now update and access - this exercises the stack
  source(1);
  void last();

  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  return after - before;
}

const depths = [10, 25, 50, 100];

console.log('Depth | Graph Only | + Access | Stack Exercise');
console.log('------|------------|----------|----------------');

for (const depth of depths) {
  const graphOnly = measureGraphOnly(depth);
  const withAccess = measureGraphWithAccess(depth);
  const stackExercise = measureStackUsage(depth);

  console.log(
    `${String(depth).padStart(5)} | ` +
    `${(graphOnly / 1024).toFixed(2).padStart(9)} KB | ` +
    `${(withAccess / 1024).toFixed(2).padStart(7)} KB | ` +
    `${(stackExercise / 1024).toFixed(2).padStart(13)} KB`
  );
}

console.log('\nAnalysis:');
console.log('- "Graph Only" should be ~160 bytes/node (nodes + edges)');
console.log('- "+ Access" should be slightly higher (tracking overhead)');
console.log('- "Stack Exercise" should be ~0-16 bytes/node (stack frames during traversal)');
console.log('\nIf "Stack Exercise" is significantly > 0, stack isn\'t being released properly.');
console.log('If "+ Access" >> "Graph Only", dependency tracking is creating extra allocations.');