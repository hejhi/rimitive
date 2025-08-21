import { describe, it, expect } from 'vitest';
import { createTestInstance } from './test-setup';

describe('Validate Fix', () => {
  it('should update all computeds that depend on a signal', () => {
    const { signal, computed, batch } = createTestInstance();
    
    const root = signal(0);
    const c1 = computed(() => root() * 2);
    const c2 = computed(() => root() * 3);
    const c3 = computed(() => root() * 4);
    
    expect(c1()).toBe(0);
    expect(c2()).toBe(0);
    expect(c3()).toBe(0);
    
    batch(() => {
      root(10);
    });
    
    // All computeds should update
    expect(c1()).toBe(20);
    expect(c2()).toBe(30);
    expect(c3()).toBe(40);
  });
});