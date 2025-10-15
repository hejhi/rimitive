/**
 * Micro-benchmark comparing single-loop vs two-loop LIS implementations
 */

// Shared buffers (simulating reconciler closure)
const oldIndicesBuf: number[] = [];
const lisBuf: number[] = [];
const tailsBuf: number[] = [];
const parentBuf: number[] = [];

const binarySearch = (arr: number[], tails: number[], len: number, value: number): number => {
  let lo = 0;
  let hi = len - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[tails[mid]!]! < value) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
};

// ORIGINAL: Two separate loops
const findLIS_TwoLoop = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;

  for (let i = 0; i < n; i++) {
    const value = arr[i]!;
    const pos = binarySearch(arr, tailsBuf, len, value);

    parentBuf[i] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = i;

    if (pos === len) len++;
  }

  // Backtrack to build LIS indices
  let current = tailsBuf[len - 1]!;
  for (let i = len - 1; i >= 0; i--) {
    lisBuf[i] = current;
    current = parentBuf[current]!;
  }

  return len;
};

// NEW: Single loop with phase switching
const findLIS_SingleLoop = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;
  let current = -1;

  for (;;) {
    // Forward phase
    if (current === -1 && depth < n) {
      const value = arr[depth]!;
      const pos = binarySearch(arr, tailsBuf, len, value);

      parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
      tailsBuf[pos] = depth;

      if (pos === len) len++;
      depth++;
      continue;
    }

    // Transition
    if (current === -1) {
      current = tailsBuf[len - 1]!;
      depth = len - 1;
    }

    // Backtrack phase
    lisBuf[depth] = current;
    current = parentBuf[current]!;
    depth--;

    if (depth >= 0) continue;

    return len;
  }
};

// Generate test data
function generateTestData(size: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * size));
  }
  return arr;
}

// Benchmark runner
function benchmark(name: string, fn: (arr: number[], n: number) => number, arr: number[], iterations: number) {
  // Warmup
  for (let i = 0; i < 1000; i++) {
    fn(arr, arr.length);
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(arr, arr.length);
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;

  console.log(`${name}:`);
  console.log(`  Total: ${totalTime.toFixed(2)}ms`);
  console.log(`  Avg: ${avgTime.toFixed(4)}ms`);
  console.log(`  Ops/sec: ${(1000 / avgTime).toFixed(0)}`);
}

// Run benchmarks
console.log('=== LIS Implementation Benchmark ===\n');

const sizes = [10, 50, 100, 500, 1000];
const iterations = 10000;

for (const size of sizes) {
  console.log(`\nArray size: ${size}, Iterations: ${iterations}`);
  const testData = generateTestData(size);

  benchmark('Two-Loop', findLIS_TwoLoop, testData, iterations);
  benchmark('Single-Loop', findLIS_SingleLoop, testData, iterations);

  // Verify they produce same results
  const result1 = findLIS_TwoLoop(testData, testData.length);
  const lis1 = [...lisBuf.slice(0, result1)];

  const result2 = findLIS_SingleLoop(testData, testData.length);
  const lis2 = [...lisBuf.slice(0, result2)];

  if (result1 !== result2 || JSON.stringify(lis1) !== JSON.stringify(lis2)) {
    console.error('ERROR: Results differ!');
  } else {
    console.log('✓ Results match');
  }
}
