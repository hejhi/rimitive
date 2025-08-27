import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, batch, computed, resetGlobalState } from './test-setup';

describe('batch', () => {
  beforeEach(() => {
    // Clean state between tests
    resetGlobalState();
  });

  it('should execute function and return its result', () => {
    const result = batch(() => {
      return 42;
    });
    
    expect(result).toBe(42);
  });

  it('should batch multiple signal updates', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    const s3 = signal(3);
    
    let effectCount = 0;
    effect(() => {
      // Access all signals
      void s1();
      void s2();
      void s3();
      effectCount++;
    });
    
    // Reset counter after initial run
    effectCount = 0;
    
    // Without batch: each update triggers effect
    s1(10);
    s2(20);
    s3(30);
    
    expect(effectCount).toBe(3);
    
    // Reset
    effectCount = 0;
    
    // With batch: only one effect run
    batch(() => {
      s1(100);
      s2(200);
      s3(300);
    });
    
    expect(effectCount).toBe(1);
  });

  it('should batch nested signal updates', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    
    let effectCount = 0;
    effect(() => {
      void s1();
      void s2();
      effectCount++;
    });
    
    effectCount = 0;
    
    batch(() => {
      s1(10);
      batch(() => {
        s2(20);
        // Effect should not run yet
        expect(effectCount).toBe(0);
      });
      // Effect should still not run
      expect(effectCount).toBe(0);
    });
    
    // Effect runs once after outermost batch
    expect(effectCount).toBe(1);
  });

  it('should handle errors and still process batched effects', () => {
    const s = signal(1);
    let effectRan = false;
    
    effect(() => {
      void s();
      effectRan = true;
    });
    
    effectRan = false;
    
    expect(() => {
      batch(() => {
        s(2);
        throw new Error('Test error');
      });
    }).toThrow('Test error');
    
    // Effect should still run despite error
    expect(effectRan).toBe(true);
  });

  it('should work with computed values', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);
    const quadrupled = computed(() => doubled() * 2);
    
    let effectCount = 0;
    effect(() => {
      void quadrupled();
      effectCount++;
    });
    
    effectCount = 0;
    
    // Multiple updates in batch
    batch(() => {
      count(1);
      count(2);
      count(3);
    });
    
    // Effect only runs once
    expect(effectCount).toBe(1);
    expect(quadrupled()).toBe(12);
  });

  it('should handle empty batch', () => {
    const result = batch(() => {
      // Do nothing
      return 'empty';
    });
    
    expect(result).toBe('empty');
  });

  it('should allow reading signals inside batch', () => {
    const s1 = signal(10);
    const s2 = signal(20);
    
    const result = batch(() => {
      const sum = s1() + s2();
      s1(sum);
      return s1();
    });
    
    expect(result).toBe(30);
    expect(s1()).toBe(30);
  });

  it('should process effects in correct order', () => {
    const s = signal(0);
    const order: number[] = [];
    
    effect(() => {
      void s();
      order.push(1);
    });
    
    effect(() => {
      void s();
      order.push(2);
    });
    
    effect(() => {
      void s();
      order.push(3);
    });
    
    order.length = 0;
    
    batch(() => {
      s(1);
    });
    
    // Effects should run in order they were notified
    expect(order).toEqual([1, 2, 3]);
  });

  it('should handle recursive batch calls from effects', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    
    let outerEffectCount = 0;
    let innerEffectCount = 0;
    
    effect(() => {
      void s1();
      outerEffectCount++;
      
      if (s1() === 10) {
        batch(() => {
          s2(20);
        });
      }
    });
    
    effect(() => {
      void s2();
      innerEffectCount++;
    });
    
    outerEffectCount = 0;
    innerEffectCount = 0;
    
    batch(() => {
      s1(10);
    });
    
    expect(outerEffectCount).toBe(1);
    expect(innerEffectCount).toBe(1);
    expect(s2()).toBe(20);
  });

  it('should return values from batch function', () => {
    const s = signal(1);
    
    const result = batch(() => {
      s(10);
      return s() * 2;
    });
    
    expect(result).toBe(20);
    expect(s()).toBe(10);
  });
});