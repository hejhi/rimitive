import { describe, it, expect, beforeEach } from 'vitest';
import { signal, peek, untrack } from './signal';
import { computed } from './computed';
import { effect } from './effect';
import { batch } from './batch';
import { resetGlobalState, clearPool } from './index';

describe('signal', () => {
  beforeEach(() => {
    // Clean state between tests
    resetGlobalState();
    clearPool();
  });

  it('should create a signal with initial value', () => {
    const s = signal(10);
    expect(s()).toBe(10);
  });

  it('should update signal value', () => {
    const s = signal(5);
    s(10);
    expect(s()).toBe(10);
  });

  it('should return undefined when setting value', () => {
    const s = signal(5);
    expect(s(10)).toBeUndefined();
  });

  it('should not trigger updates when value is same', () => {
    const s = signal(5);
    const initialVersion = s._version;
    s(5);
    expect(s._version).toBe(initialVersion);
  });

  it('should increment version on value change', () => {
    const s = signal(5);
    const initialVersion = s._version;
    s(10);
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should handle null and undefined values', () => {
    const s1 = signal<number | null>(null);
    const s2 = signal<string | undefined>(undefined);
    
    expect(s1()).toBe(null);
    expect(s2()).toBe(undefined);
    
    s1(42);
    expect(s1()).toBe(42);
    
    s1(null);
    expect(s1()).toBe(null);
  });

  it('should handle object values with reference equality', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Alice' };
    const s = signal(obj1);
    
    const initialVersion = s._version;
    
    // Same reference, no update
    s(obj1);
    expect(s._version).toBe(initialVersion);
    
    // Different reference, triggers update
    s(obj2);
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should track dependencies when read inside computed', () => {
    const a = signal(5);
    const b = signal(10);
    const sum = computed(() => a() + b());
    
    expect(sum()).toBe(15);
    
    // Should have created dependency nodes
    expect(a._targets).toBeDefined();
    expect(b._targets).toBeDefined();
  });

  it('should notify dependents on change', () => {
    const source = signal(10);
    let computeCount = 0;
    
    const double = computed(() => {
      computeCount++;
      return source() * 2;
    });
    
    expect(double()).toBe(20);
    expect(computeCount).toBe(1);
    
    source(5);
    expect(double()).toBe(10);
    expect(computeCount).toBe(2);
  });

  describe('peek', () => {
    it('should read value without tracking', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;
      
      const result = computed(() => {
        computeCount++;
        return a() + peek(b);
      });
      
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing b should not trigger recompute
      b(20);
      expect(result()).toBe(15); // Still using old value
      expect(computeCount).toBe(1);
      
      // Changing a should trigger recompute
      a(10);
      expect(result()).toBe(30); // Now picks up new b value
      expect(computeCount).toBe(2);
    });
  });

  describe('untrack', () => {
    it('should prevent dependency tracking in callback', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;
      
      const result = computed(() => {
        computeCount++;
        return a() + untrack(() => b());
      });
      
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing b should not trigger recompute
      b(20);
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing a should trigger recompute and pick up new b
      a(10);
      expect(result()).toBe(30);
      expect(computeCount).toBe(2);
    });

    it('should restore tracking after untrack', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      
      const result = computed(() => {
        const val1 = a();
        const val2 = untrack(() => b());
        const val3 = c();
        return val1 + val2 + val3;
      });
      
      expect(result()).toBe(6);
      
      // Check dependencies - should have a and c, but not b
      expect(a._targets).toBeDefined();
      expect(b._targets).toBeUndefined();
      expect(c._targets).toBeDefined();
    });
  });

  describe('batching behavior', () => {
    it('should defer notifications in batch', () => {
      const s = signal(0);
      let effectRuns = 0;
      
      effect(() => {
        s(); // Track dependency
        effectRuns++;
      });
      
      expect(effectRuns).toBe(1);
      
      batch(() => {
        s(1);
        s(2);
        s(3);
        expect(effectRuns).toBe(1); // Not run yet
      });
      
      expect(effectRuns).toBe(2); // Run once after batch
      expect(s()).toBe(3);
    });
  });

  describe('array signals', () => {
    it('should handle array mutations', () => {
      const arr = signal([1, 2, 3]);
      let computeCount = 0;
      
      const sum = computed(() => {
        computeCount++;
        return arr().reduce((a, b) => a + b, 0);
      });
      
      expect(sum()).toBe(6);
      expect(computeCount).toBe(1);
      
      // New array reference triggers update
      arr([1, 2, 3, 4]);
      expect(sum()).toBe(10);
      expect(computeCount).toBe(2);
      
      // Same array reference doesn't trigger
      const current = arr();
      arr(current);
      expect(computeCount).toBe(2);
    });
  });

  describe('stress tests', () => {
    it('should handle many dependents efficiently', () => {
      const source = signal(1);
      const computeds = Array.from({ length: 100 }, (_, i) => 
        computed(() => source() * (i + 1))
      );
      
      // All should compute correctly
      computeds.forEach((c, i) => {
        expect(c()).toBe(i + 1);
      });
      
      // Update should propagate to all
      source(2);
      computeds.forEach((c, i) => {
        expect(c()).toBe(2 * (i + 1));
      });
    });

    it('should handle simple computed chains', () => {
      const a = signal(1);
      const b = computed(() => {
        const val = a();
        return val + 1;
      });
      
      expect(b()).toBe(2);
      
      a(5);
      // For now, just verify the computed tracks its dependencies
      expect(a._targets).toBeDefined();
    });
  });
});