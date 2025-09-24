# Memory Leak Fix Plan for Lattice

## Problem Summary
Lattice has a critical memory leak in computed→computed dependencies causing 3.82MB memory usage vs Alien-signals' 895 bytes over 100k iterations.

## Root Cause
In `/packages/signals/src/helpers/graph-edges.ts`, the `trackDependency` function only checks the next dependency in sequence. When nested computeds disrupt this sequence (common in diamond patterns), it creates duplicate Dependency objects instead of reusing existing ones.

### Evidence
- Memory leak ONLY occurs when computeds consume other reactive primitives
- Signal→Computed: No issue (dependencies stable)
- Computed→Computed: 38 bytes retained per iteration (3.82MB total over 100k)
- Alien-signals uses 3 checks to find existing dependencies; Lattice uses only 1

## Solution Implementation

### 1. Fix trackDependency Function
**File**: `/packages/signals/src/helpers/graph-edges.ts`

**Current Code (lines 30-58)**:
```typescript
// Only checks next in sequence
const next = tail ? tail.nextDependency : consumer.dependencies;
if (next && next.producer === producer) {
  consumer.dependencyTail = next;
  return;
}
// Falls through and creates NEW dependency
```

**Required Fix**:
```typescript
const trackDependency = (producer: ProducerNode, consumer: ConsumerNode) => {
  const tail = consumer.dependencyTail;

  // Check 1: Is tail already pointing to this producer?
  if (tail && tail.producer === producer) {
    return; // Already tracking
  }

  // Check 2: Is next in sequence this producer?
  const next = tail ? tail.nextDependency : consumer.dependencies;
  if (next && next.producer === producer) {
    consumer.dependencyTail = next;
    return; // Found and reused
  }

  // Check 3: CRITICAL NEW CODE - Search all existing dependencies
  let dep = consumer.dependencies;
  while (dep && dep !== next) {
    if (dep.producer === producer) {
      consumer.dependencyTail = dep;
      return; // Found existing edge, reuse it
    }
    dep = dep.nextDependency;
  }

  // Only NOW create new dependency if not found
  const producerTail = producer.subscribersTail;
  const dependency: Dependency = {
    producer,
    consumer,
    prevDependency: tail,
    prevConsumer: producerTail,
    nextDependency: next,
    nextConsumer: undefined,
  };

  // Wire up consumer side
  consumer.dependencyTail = dependency;
  if (next) next.prevDependency = dependency;
  if (tail) tail.nextDependency = dependency;
  else consumer.dependencies = dependency;

  // Wire up producer side
  producer.subscribersTail = dependency;
  if (producerTail) producerTail.nextConsumer = dependency;
  else producer.subscribers = dependency;
};
```

### 2. Test Implementation

Create test file `/packages/signals/src/helpers/dependency-deduplication.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createApi } from '../../benchmarks/src/suites/lattice/helpers/signal-computed';

describe('Dependency Deduplication', () => {
  it('should not create duplicate dependencies in diamond pattern', () => {
    const api = createApi();
    const { signal, computed } = api;

    // Diamond pattern
    const source = signal(0);
    const left = computed(() => source());
    const right = computed(() => source());
    const bottom = computed(() => left() + right());

    // Initial evaluation
    bottom();

    // Count initial dependencies
    let depCount = 0;
    let dep = bottom.dependencies;
    while (dep) {
      depCount++;
      dep = dep.nextDependency;
    }
    const initialDeps = depCount;

    // Run many iterations
    for (let i = 0; i < 1000; i++) {
      source(i);
      bottom();
    }

    // Count dependencies again
    depCount = 0;
    dep = bottom.dependencies;
    while (dep) {
      depCount++;
      dep = dep.nextDependency;
    }

    // Should not have accumulated
    expect(depCount).toBe(initialDeps);
  });

  it('should handle deeply nested computeds', () => {
    const api = createApi();
    const { signal, computed } = api;

    const s = signal(0);
    const c1 = computed(() => s());
    const c2 = computed(() => c1());
    const c3 = computed(() => c2());
    const c4 = computed(() => c3());
    const c5 = computed(() => c4());

    // Run many times
    for (let i = 0; i < 1000; i++) {
      s(i);
      c5();
    }

    // Check c5 has only one dependency (c4)
    let depCount = 0;
    let dep = c5.dependencies;
    while (dep) {
      depCount++;
      dep = dep.nextDependency;
    }
    expect(depCount).toBe(1);
  });
});
```

### 3. Memory Regression Test

Create `/packages/signals/src/memory-regression.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createApi } from '../../benchmarks/src/suites/lattice/helpers/signal-computed';

describe('Memory Regression', () => {
  it('should not leak memory in diamond pattern', () => {
    if (!global.gc) {
      console.warn('Run with --expose-gc for accurate memory test');
      return;
    }

    const api = createApi();
    const { signal, computed } = api;

    // Force GC and measure baseline
    global.gc();
    const memBefore = process.memoryUsage().heapUsed;

    // Create diamond pattern
    const source = signal(0);
    const left = computed(() => source() * 2);
    const right = computed(() => source() * 3);
    const bottom = computed(() => left() + right());

    // Run many iterations
    for (let i = 0; i < 10000; i++) {
      source(i);
      bottom();
    }

    // Force GC and measure
    global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

    console.log(`Memory used: ${memUsed.toFixed(2)} MB`);

    // Should use less than 0.1 MB (vs 3.82 MB before fix)
    expect(memUsed).toBeLessThan(0.1);
  });
});
```

## Performance Considerations

- **Trade-off**: O(n) search where n = dependencies per node
- **Typical case**: n < 10, so linear search is fast
- **Worst case**: If n grows large, consider Map/Set refactor
- **Expected impact**: <5% performance regression, 75%+ memory savings

## Validation Steps

1. Run tests: `pnpm --filter @lattice/signals test`
2. Run memory test: `NODE_OPTIONS="--expose-gc" pnpm --filter @lattice/signals test memory-regression`
3. Run benchmarks: `pnpm bench --skip-build computed-diamond-simple`
4. Verify memory drops from 3.82MB to <1MB
5. Ensure performance regression <5%

## Files to Clean Up
- Remove `/Users/henryivry/repos/lattice/test-memory-issue.js`
- Update `/Users/henryivry/repos/lattice/memory-issue.md` with solution

## Consensus from Analysis
All three AI models (including adversarial stance) agreed with 9-10/10 confidence this is:
- A critical bug fix (not optimization)
- Makes library unusable without fix (4200x memory increase)
- O(n) trade-off is negligible for typical use
- Low risk, high reward change