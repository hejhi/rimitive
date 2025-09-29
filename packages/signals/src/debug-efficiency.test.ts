import { describe, it, expect } from 'vitest';
import { signal, computed } from './test-setup';

describe('Debug efficiency', () => {
  it('should skip downstream recomputation when intermediate value does not change', () => {
    const s = signal(2);

    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      const result = Math.abs(s());
      console.log(`A computed #${computeCountA}: s=${s()} -> ${result}`);
      return result;
    });

    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      const result = a() * 3;
      console.log(`B computed #${computeCountB}: a=${a()} -> ${result}`);
      return result;
    });

    // Initial computation
    console.log('Initial:');
    expect(b()).toBe(6); // abs(2) * 3
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1);

    // Change signal to -2 (a's value stays 2)
    console.log('\nChanging s to -2:');
    s(-2);

    // Read b - a MUST recompute to know its value didn't change
    // But b should NOT recompute since a's value stayed the same
    console.log('Reading b:');
    expect(b()).toBe(6);
    expect(computeCountA).toBe(2); // A correctly recomputed

    console.log(`B compute count: ${computeCountB}, expected: 1`);
    expect(computeCountB).toBe(1); // B should NOT recompute!
  });
});