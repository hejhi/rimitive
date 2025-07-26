import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, batch, computed, subscribe, resetGlobalState } from './test-setup';

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
      void s1.value;
      void s2.value;
      void s3.value;
      effectCount++;
    });
    
    // Reset counter after initial run
    effectCount = 0;
    
    // Without batch: each update triggers effect
    s1.value = 10;
    s2.value = 20;
    s3.value = 30;
    
    expect(effectCount).toBe(3);
    
    // Reset
    effectCount = 0;
    
    // With batch: only one effect run
    batch(() => {
      s1.value = 100;
      s2.value = 200;
      s3.value = 300;
    });
    
    expect(effectCount).toBe(1);
  });

  it('should batch nested signal updates', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    
    let effectCount = 0;
    effect(() => {
      void s1.value;
      void s2.value;
      effectCount++;
    });
    
    effectCount = 0;
    
    batch(() => {
      s1.value = 10;
      batch(() => {
        s2.value = 20;
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
      void s.value;
      effectRan = true;
    });
    
    effectRan = false;
    
    expect(() => {
      batch(() => {
        s.value = 2;
        throw new Error('Test error');
      });
    }).toThrow('Test error');
    
    // Effect should still run despite error
    expect(effectRan).toBe(true);
  });

  it('should work with computed values', () => {
    const count = signal(0);
    const doubled = computed(() => count.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    
    let effectCount = 0;
    effect(() => {
      void quadrupled.value;
      effectCount++;
    });
    
    effectCount = 0;
    
    // Multiple updates in batch
    batch(() => {
      count.value = 1;
      count.value = 2;
      count.value = 3;
    });
    
    // Effect only runs once
    expect(effectCount).toBe(1);
    expect(quadrupled.value).toBe(12);
  });

  it('should batch subscribe callbacks', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    
    let callback1Count = 0;
    let callback2Count = 0;
    
    subscribe(s1, () => callback1Count++);
    subscribe(s2, () => callback2Count++);
    
    // Reset after initial subscription callbacks
    callback1Count = 0;
    callback2Count = 0;
    
    batch(() => {
      s1.value = 10;
      s2.value = 20;
      // Callbacks should not have run yet
      expect(callback1Count).toBe(0);
      expect(callback2Count).toBe(0);
    });
    
    // Callbacks run after batch
    expect(callback1Count).toBe(1);
    expect(callback2Count).toBe(1);
  });

  it('should handle mixed effects and subscribes in batch', () => {
    const s = signal(1);
    
    let effectCount = 0;
    let subscribeCount = 0;
    
    effect(() => {
      void s.value;
      effectCount++;
    });
    
    subscribe(s, () => subscribeCount++);
    
    // Reset counters
    effectCount = 0;
    subscribeCount = 0;
    
    batch(() => {
      s.value = 2;
      s.value = 3;
      s.value = 4;
    });
    
    // Both should run exactly once
    expect(effectCount).toBe(1);
    expect(subscribeCount).toBe(1);
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
      const sum = s1.value + s2.value;
      s1.value = sum;
      return s1.value;
    });
    
    expect(result).toBe(30);
    expect(s1.value).toBe(30);
  });

  it('should process effects in correct order', () => {
    const s = signal(0);
    const order: number[] = [];
    
    effect(() => {
      void s.value;
      order.push(1);
    });
    
    effect(() => {
      void s.value;
      order.push(2);
    });
    
    effect(() => {
      void s.value;
      order.push(3);
    });
    
    order.length = 0;
    
    batch(() => {
      s.value = 1;
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
      void s1.value;
      outerEffectCount++;
      
      if (s1.value === 10) {
        batch(() => {
          s2.value = 20;
        });
      }
    });
    
    effect(() => {
      void s2.value;
      innerEffectCount++;
    });
    
    outerEffectCount = 0;
    innerEffectCount = 0;
    
    batch(() => {
      s1.value = 10;
    });
    
    expect(outerEffectCount).toBe(1);
    expect(innerEffectCount).toBe(1);
    expect(s2.value).toBe(20);
  });

  it('should return values from batch function', () => {
    const s = signal(1);
    
    const result = batch(() => {
      s.value = 10;
      return s.value * 2;
    });
    
    expect(result).toBe(20);
    expect(s.value).toBe(10);
  });
});