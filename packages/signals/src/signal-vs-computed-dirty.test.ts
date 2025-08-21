import { describe, it, expect } from 'vitest';
import { signal, computed, effect } from './test-setup';

describe('Signal vs Computed Dirty Flag Behavior', () => {
  it('signals never clear their dirty flag after being set', () => {
    const sig = signal(5);
    let effectRuns = 0;
    
    // Create effect that reads signal directly
    effect(() => {
      effectRuns++;
      void sig();
    });
    
    expect(effectRuns).toBe(1);
    
    // Change signal
    sig(10);
    expect(effectRuns).toBe(2); // Effect runs
    
    // Change signal again
    sig(15);
    expect(effectRuns).toBe(3); // Effect runs again
  });

  it('computeds clear dirty flag when value does not change', () => {
    const source = signal(5);
    const comp = computed(() => {
      const value = source();
      return value > 0 ? 1 : 0;
    });
    
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      void comp();
    });
    
    expect(effectRuns).toBe(1);
    
    // Change source but computed output stays same
    source(10);
    
    // Computed re-evaluates and clears dirty flag because value didn't change
    expect(effectRuns).toBe(1); // Effect should NOT run
  });

  it('the key difference: signal dirty flag persists, computed dirty flag clears', () => {
    const sig1 = signal(5);
    const sig2 = signal(5); 
    const sig3 = signal(5);
    
    const comp1 = computed(() => sig1() > 0 ? 1 : 0);
    const comp2 = computed(() => sig2() > 0 ? 1 : 0);
    const comp3 = computed(() => sig3() > 0 ? 1 : 0);
    
    let signalEffectRuns = 0;
    let computedEffectRuns = 0;
    
    // Effect depending on signals directly
    effect(() => {
      signalEffectRuns++;
      void (sig1() + sig2() + sig3());
    });
    
    // Effect depending on computeds
    effect(() => {
      computedEffectRuns++;
      void (comp1() + comp2() + comp3());
    });
    
    expect(signalEffectRuns).toBe(1);
    expect(computedEffectRuns).toBe(1);
    
    sig1(10);
    
    // Signal effect runs because sig1 is dirty
    expect(signalEffectRuns).toBe(2);
    
    // For computed effect: comp1 re-evaluates, clears dirty flag (value unchanged)
    // But comp2 and comp3 were NEVER re-evaluated, so they still have dirty=true from initial run!
    expect(computedEffectRuns).toBe(1); // Should be 1, but will be 2 due to bug
  });
});