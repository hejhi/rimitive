import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, resetGlobalState } from './test-setup';

describe('Pull Update Efficiency', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should NOT recompute when all dependencies are clean', () => {
    const s = signal(1);
    
    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      return s() * 2;
    });
    
    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      return a() * 2;
    });
    
    let computeCountC = 0;
    const c = computed(() => {
      computeCountC++;
      return b() * 2;
    });
    
    // Initial computation
    expect(c()).toBe(8);
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1);
    expect(computeCountC).toBe(1);
    
    // Read again without any changes - should NOT recompute
    expect(c()).toBe(8);
    expect(computeCountA).toBe(1); // Should still be 1
    expect(computeCountB).toBe(1); // Should still be 1
    expect(computeCountC).toBe(1); // Should still be 1
  });

  it('CORRECT: must recompute PENDING nodes to detect if value changed', () => {
    const s = signal(2);
    
    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      return Math.abs(s()); // abs(2) = 2, abs(-2) = 2
    });
    
    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      return a() * 3;
    });
    
    // Initial computation
    expect(b()).toBe(6);
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1);
    
    // Change signal to -2 (a's value stays 2)
    s(-2);
    
    // Read b - a MUST recompute to know its value didn't change
    expect(b()).toBe(6);
    expect(computeCountA).toBe(2); // A correctly recomputed
    expect(computeCountB).toBe(1); // B correctly skipped (A's value didn't change)
  });

  it('should NOT recompute descendants when intermediate values dont change', () => {
    const s1 = signal(1);
    const s2 = signal(10);
    
    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      return s1() + s2();
    });
    
    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      return a() * 2;
    });
    
    let computeCountC = 0;
    const c = computed(() => {
      computeCountC++;
      return b() + 100;
    });
    
    // Initial
    expect(c()).toBe(122); // (1+10)*2 + 100
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1);
    expect(computeCountC).toBe(1);
    
    // Change s1 from 1 to 2
    s1(2);
    
    // Read c - everything should recompute
    expect(c()).toBe(124); // (2+10)*2 + 100
    expect(computeCountA).toBe(2);
    expect(computeCountB).toBe(2);
    expect(computeCountC).toBe(2);
    
    // Now change both signals such that a's value doesn't change
    s1(5);  // 5 + 7 = 12
    s2(7);  // same as 2 + 10 = 12
    
    // Read c
    expect(c()).toBe(124); // (5+7)*2 + 100 = same as before
    expect(computeCountA).toBe(3); // A recomputed
    expect(computeCountB).toBe(2); // B should NOT recompute since A's value didn't change
    
    // INEFFICIENCY: C shouldn't recompute since B didn't change
    expect(computeCountC).toBe(2); // C should NOT recompute since B didn't change
  });

  it('should NOT recompute when all ancestors are unchanged', () => {
    const s = signal(1);
    
    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      return Math.floor(s() / 2); // 1/2=0, 2/2=1, 3/2=1 (same as 2)
    });
    
    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      return a() * 10;
    });
    
    let computeCountC = 0;
    const c = computed(() => {
      computeCountC++;
      return b() + 1000;
    });
    
    // Initial
    expect(c()).toBe(1000); // floor(1/2)*10 + 1000 = 0*10 + 1000
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1); 
    expect(computeCountC).toBe(1);
    
    // Change s to 2
    s(2);
    expect(c()).toBe(1010); // floor(2/2)*10 + 1000 = 1*10 + 1000
    expect(computeCountA).toBe(2);
    expect(computeCountB).toBe(2);
    expect(computeCountC).toBe(2);
    
    // Change s to 3 - A's value stays 1
    s(3);
    expect(c()).toBe(1010); // floor(3/2)*10 + 1000 = 1*10 + 1000
    expect(computeCountA).toBe(3); // A recomputes
    expect(computeCountB).toBe(2); // B doesn't recompute (A's value unchanged)
    
    // INEFFICIENCY: C shouldn't recompute since B didn't change
    expect(computeCountC).toBe(2); // Should NOT recompute - B never changed!
  });

  it('should only update PENDING nodes in the pull path', () => {
    const s = signal(1);
    
    let computeCountA = 0;
    const a = computed(() => {
      computeCountA++;
      return s() * 2;
    });
    
    let computeCountB = 0;
    const b = computed(() => {
      computeCountB++;
      return a() * 2;
    });
    
    let computeCountC = 0;
    const c = computed(() => {
      computeCountC++;
      return a() * 3; // Also depends on A
    });
    
    // Initial computation
    expect(b()).toBe(4);
    expect(c()).toBe(6);
    expect(computeCountA).toBe(1);
    expect(computeCountB).toBe(1);
    expect(computeCountC).toBe(1);
    
    // Change signal
    s(2);
    
    // Read only B - should update A and B, but NOT C
    expect(b()).toBe(8);
    expect(computeCountA).toBe(2);
    expect(computeCountB).toBe(2);
    expect(computeCountC).toBe(1); // C not in pull path
    
    // Now read C - A is already updated, so only C computes
    expect(c()).toBe(12);
    expect(computeCountA).toBe(2); // A already updated
    expect(computeCountC).toBe(2); // C updates now
  });
});