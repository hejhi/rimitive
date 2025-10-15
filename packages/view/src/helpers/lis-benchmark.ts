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

// OLD: Single loop with phase switching (current === -1)
const findLIS_SingleLoop_Old = (arr: number[], n: number): number => {
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

// LATEST: Simplified with depth check and do-while backtrack
const findLIS_Latest = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;

  for (;;) {
    // Forward phase: build tails and parent pointers
    if (depth < n) {
      const value = arr[depth]!;
      const pos = binarySearch(arr, tailsBuf, len, value);

      parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
      tailsBuf[pos] = depth;

      if (pos === len) len++;
      depth++;
      continue;
    }

    // Transition to backtrack
    depth = len - 1;
    let current = tailsBuf[depth]!;

    // Backtrack phase: reconstruct LIS using parent chain
    do {
      lisBuf[depth] = current;
      current = parentBuf[current]!;
    } while (depth--);

    return len;
  }
};

// NEWEST: Both phases using do-while loops with inline increments
const findLIS_DoWhile = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;
  let current = 0;

  do {
    const value = arr[depth]!;
    const pos = binarySearch(arr, tailsBuf, len, value);

    parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = depth;

    if (pos === len) len++;
  } while (depth++ < n);

  depth = len - 1;
  current = tailsBuf[depth]!;

  do {
    lisBuf[depth] = current;
    current = parentBuf[current]!;
  } while (depth--);

  return len;
};

// CURRENT: Forward with break, backtrack with do-while
const findLIS_Current = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;
  let current = 0;

  for (;;) {
    // Forward phase: build tails and parent pointers
    if (depth < n) {
      const value = arr[depth]!;
      const pos = binarySearch(arr, tailsBuf, len, value);

      parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
      tailsBuf[pos] = depth;

      if (pos === len) len++;
      depth++;
      continue;
    }
    break;
  }

  depth = len - 1;
  current = tailsBuf[depth]!;

  // Backtrack phase: reconstruct LIS using parent chain
  do {
    lisBuf[depth] = current;
    current = parentBuf[current]!;
  } while (depth--);

  return len;
};

// ORIGINAL OPTIMIZED: Both phases using do-while (from earlier iterations)
const findLIS_DoWhile_Original = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;
  let current = 0;

  // Forward phase: build tails and parent pointers
  do {
    const value = arr[depth]!;
    const pos = binarySearch(arr, tailsBuf, len, value);

    parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = depth;

    if (pos === len) len++;
    depth++;
  } while (depth < n);

  // Transition to backtrack
  depth = len - 1;
  current = tailsBuf[depth]!;

  // Backtrack phase: reconstruct LIS using parent chain
  do {
    lisBuf[depth] = current;
    current = parentBuf[current]!;
  } while (depth--);

  return len;
};

// NEWEST: Backtrack pulled out of loop with break
const findLIS_Newest = (arr: number[], n: number): number => {
  if (n === 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  let len = 0;
  let depth = 0;
  let current = 0;

  for (;;) {
    // Forward phase: build tails and parent pointers
    if (depth < n) {
      const value = arr[depth]!;
      const pos = binarySearch(arr, tailsBuf, len, value);

      parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
      tailsBuf[pos] = depth;

      if (pos === len) len++;
      depth++;
      continue;
    }

    // Transition to backtrack
    depth = len - 1;
    current = tailsBuf[depth]!;

    // Both phases complete
    break;
  }

  // Backtrack phase: reconstruct LIS using parent chain
  do {
    lisBuf[depth] = current;
    current = parentBuf[current]!;
  } while (depth--);

  return len;
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
  benchmark('Single-Loop (Old)', findLIS_SingleLoop_Old, testData, iterations);
  benchmark('Latest', findLIS_Latest, testData, iterations);
  benchmark('DoWhile', findLIS_DoWhile, testData, iterations);
  benchmark('Current', findLIS_Current, testData, iterations);

  // Verify they produce same results
  const result1 = findLIS_TwoLoop(testData, testData.length);
  const lis1 = [...lisBuf.slice(0, result1)];

  const result2 = findLIS_SingleLoop_Old(testData, testData.length);
  const lis2 = [...lisBuf.slice(0, result2)];

  const result3 = findLIS_Latest(testData, testData.length);
  const lis3 = [...lisBuf.slice(0, result3)];

  const result4 = findLIS_DoWhile(testData, testData.length);
  const lis4 = [...lisBuf.slice(0, result4)];

  const result5 = findLIS_Current(testData, testData.length);
  const lis5 = [...lisBuf.slice(0, result5)];

  if (result1 !== result2 || result1 !== result3 || result1 !== result4 || result1 !== result5 ||
      JSON.stringify(lis1) !== JSON.stringify(lis2) ||
      JSON.stringify(lis1) !== JSON.stringify(lis3) ||
      JSON.stringify(lis1) !== JSON.stringify(lis4) ||
      JSON.stringify(lis1) !== JSON.stringify(lis5)) {
    console.error('ERROR: Results differ!');
  } else {
    console.log('✓ All results match');
  }
}
