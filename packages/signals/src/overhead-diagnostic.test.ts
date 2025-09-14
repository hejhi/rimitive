import { describe, it, expect } from 'vitest';
import { createTestInstance } from './test-setup';
import { createNodeScheduler } from './helpers/node-scheduler';

describe('Performance Overhead Diagnostics', () => {
  it('should measure abstraction overhead', () => {
    const iterations = 100000;

    // Test 1: Function call vs direct property access
    const scheduler = createNodeScheduler();

    // Warm up
    for (let i = 0; i < 1000; i++) {
      scheduler.inBatch();
    }

    // Measure function call overhead
    const funcStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      scheduler.inBatch();
    }
    const funcTime = performance.now() - funcStart;

    // Measure direct property access (if we had it)
    // This shows the overhead of the function call
    const directStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      // @ts-ignore - accessing private property for testing
      !!scheduler._batchDepth;
    }
    const directTime = performance.now() - directStart;

    console.log(`Function call time: ${funcTime.toFixed(2)}ms`);
    console.log(`Direct access time: ${directTime.toFixed(2)}ms`);
    console.log(`Overhead: ${(funcTime / directTime).toFixed(2)}x slower`);

    // Test 2: Closure vs method call
    const { signal, effect } = createTestInstance();

    // Create a signal and measure update overhead
    const s = signal(0);
    let effectCount = 0;
    effect(() => {
      s();
      effectCount++;
    });

    effectCount = 0;

    // Measure signal write overhead with full abstraction
    const signalStart = performance.now();
    for (let i = 0; i < iterations / 100; i++) {
      s(i);
    }
    const signalTime = performance.now() - signalStart;

    console.log(`Signal updates: ${signalTime.toFixed(2)}ms for ${iterations / 100} updates`);
    console.log(`Effect runs: ${effectCount}`);

    // Test 3: FIFO queue overhead
    const queueStart = performance.now();
    let head: any = undefined;
    let tail: any = undefined;

    for (let i = 0; i < iterations; i++) {
      // Simulate enqueue
      const node = { next: undefined, value: i };
      if (tail) {
        tail.next = node;
      } else {
        head = node;
      }
      tail = node;

      // Simulate dequeue
      if (head) {
        head;
        head = head.next;
        if (!head) tail = undefined;
      }
    }
    const queueTime = performance.now() - queueStart;

    // Compare with array push/shift
    const arrayStart = performance.now();
    const arr: number[] = [];
    for (let i = 0; i < iterations; i++) {
      arr.push(i);
      arr.shift();
    }
    const arrayTime = performance.now() - arrayStart;

    console.log(`FIFO linked list: ${queueTime.toFixed(2)}ms`);
    console.log(`Array push/shift: ${arrayTime.toFixed(2)}ms`);
    console.log(`Queue overhead: ${(queueTime / arrayTime).toFixed(2)}x faster`);

    // Test 4: Bit flags vs boolean
    const flagStart = performance.now();
    let flags = 0;
    for (let i = 0; i < iterations; i++) {
      flags |= 1;  // Set flag
      if (flags & 1) { // Check flag
        flags &= ~1; // Clear flag
      }
    }
    const flagTime = performance.now() - flagStart;

    const boolStart = performance.now();
    let bool = false;
    for (let i = 0; i < iterations; i++) {
      bool = true;
      if (bool) {
        bool = false;
      }
    }
    const boolTime = performance.now() - boolStart;

    console.log(`Bit flags: ${flagTime.toFixed(2)}ms`);
    console.log(`Boolean: ${boolTime.toFixed(2)}ms`);
    console.log(`Flag overhead: ${(flagTime / boolTime).toFixed(2)}x slower`);

    expect(true).toBe(true); // Just to make test pass
  });

  it('should measure propagation overhead', () => {
    const iterations = 10000;
    const { signal, computed, effect } = createTestInstance();

    // Create a dependency chain
    const s = signal(0);
    const c1 = computed(() => s() * 2);
    const c2 = computed(() => c1() * 2);
    const c3 = computed(() => c2() * 2);

    let effectRuns = 0;
    effect(() => {
      c3();
      effectRuns++;
    });

    effectRuns = 0;

    // Measure propagation time
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      s(i);
    }
    const time = performance.now() - start;

    console.log(`\nPropagation benchmark:`);
    console.log(`${iterations} updates through 3-layer chain: ${time.toFixed(2)}ms`);
    console.log(`Average per update: ${(time / iterations * 1000).toFixed(2)}µs`);
    console.log(`Effect runs: ${effectRuns}`);

    expect(effectRuns).toBeGreaterThanOrEqual(iterations - 1); // Off by one is ok
  });

  it('should identify specific signal write overhead', () => {
    const iterations = 100000;

    // Create a minimal signal-like implementation for comparison
    let minimalValue = 0;
    let minimalDirty = false;
    const minimalSubscribers: Array<() => void> = [];

    const minimalSignal = (newValue?: number) => {
      if (newValue !== undefined) {
        if (minimalValue !== newValue) {
          minimalValue = newValue;
          minimalDirty = true;
          // Direct propagation
          for (const sub of minimalSubscribers) {
            sub();
          }
          // Use dirty flag (could be used for change detection)
          if (minimalDirty) minimalDirty = false;
        }
      }
      return minimalValue;
    };

    // Warm up
    for (let i = 0; i < 1000; i++) {
      minimalSignal(i);
    }

    // Measure minimal implementation
    const minimalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      minimalSignal(i);
    }
    const minimalTime = performance.now() - minimalStart;

    // Now measure Lattice signal
    const { signal } = createTestInstance();
    const s = signal(0);

    // Warm up
    for (let i = 0; i < 1000; i++) {
      s(i);
    }

    const latticeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      s(i);
    }
    const latticeTime = performance.now() - latticeStart;

    console.log(`\nSignal Write Hot Path Analysis:`);
    console.log(`Minimal implementation: ${minimalTime.toFixed(2)}ms`);
    console.log(`Lattice implementation: ${latticeTime.toFixed(2)}ms`);
    console.log(`Overhead: ${(latticeTime / minimalTime).toFixed(2)}x slower`);
    console.log(`Per-write overhead: ${((latticeTime - minimalTime) / iterations * 1000000).toFixed(0)}ns`);

    expect(true).toBe(true);
  });
});