import { describe, expect, it } from 'vitest';
import { signal, computed, effect } from './test-setup';

describe('Computed peek()', () => {
  it('should read computed value without establishing dependencies', () => {
    const count = signal(0);
    const double = computed(() => count() * 2);
    
    let effectRuns = 0;
    effect(() => {
      // This effect should NOT run when we peek
      void double();
      effectRuns++;
    });
    
    expect(effectRuns).toBe(1); // Initial run
    
    // Peek should not trigger the effect
    const peekedValue = double.peek();
    expect(peekedValue).toBe(0);
    
    // Change the source signal
    count(5);
    expect(effectRuns).toBe(2); // Effect runs due to dependency
    
    // Peek again - should get updated value without triggering effect
    const peekedValue2 = double.peek();
    expect(peekedValue2).toBe(10);
    expect(effectRuns).toBe(2); // Still 2, peek didn't trigger
  });

  it('should return the same value as .value', () => {
    const a = signal(10);
    const b = signal(20);
    const sum = computed(() => a() + b());
    
    expect(sum.peek()).toBe(sum());
    
    a(15);
    expect(sum.peek()).toBe(sum());
    expect(sum.peek()).toBe(35);
  });

  it('should work with nested computeds', () => {
    const base = signal(5);
    const double = computed(() => base() * 2);
    const quad = computed(() => double() * 2);
    
    expect(quad.peek()).toBe(20);
    
    base(10);
    expect(quad.peek()).toBe(40);
    
    // Peek doesn't establish dependencies
    let tracked = false;
    effect(() => {
      void quad.peek(); // This should not track
      tracked = true;
    });
    
    expect(tracked).toBe(true);
    tracked = false;
    
    base(15);
    expect(tracked).toBe(false); // Effect didn't re-run
    expect(quad.peek()).toBe(60);
  });
});