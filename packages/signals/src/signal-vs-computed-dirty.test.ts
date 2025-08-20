import { describe, it, expect } from 'vitest';
import { signal, computed, effect } from './test-setup';

describe('Signal vs Computed Dirty Flag Behavior', () => {
  it('signals never clear their dirty flag after being set', () => {
    console.log('\n=== SIGNAL DIRTY FLAG TEST ===\n');
    
    const sig = signal(5);
    let effectRuns = 0;
    
    // Create effect that reads signal directly
    effect(() => {
      effectRuns++;
      const value = sig();
      console.log(`Effect run #${effectRuns}: signal = ${value}`);
    });
    
    expect(effectRuns).toBe(1);
    
    // Change signal
    console.log('Changing signal from 5 to 10...');
    sig(10);
    expect(effectRuns).toBe(2); // Effect runs
    
    // Change signal again
    console.log('Changing signal from 10 to 15...');
    sig(15);
    expect(effectRuns).toBe(3); // Effect runs again
    
    console.log('Signal ALWAYS triggers effects when value changes (dirty flag stays true)');
  });

  it('computeds clear dirty flag when value does not change', () => {
    console.log('\n=== COMPUTED DIRTY FLAG TEST ===\n');
    
    const source = signal(5);
    const comp = computed(() => {
      const value = source();
      console.log(`  Computed evaluating: source=${value}, returning ${value > 0 ? 1 : 0}`);
      return value > 0 ? 1 : 0;
    });
    
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      const value = comp();
      console.log(`Effect run #${effectRuns}: computed = ${value}`);
    });
    
    expect(effectRuns).toBe(1);
    
    // Change source but computed output stays same
    console.log('Changing source from 5 to 10 (computed still returns 1)...');
    source(10);
    
    // Computed re-evaluates and clears dirty flag because value didn't change
    expect(effectRuns).toBe(1); // Effect should NOT run
    
    console.log('Computed cleared dirty flag when value unchanged');
  });

  it('the key difference: signal dirty flag persists, computed dirty flag clears', () => {
    console.log('\n=== KEY DIFFERENCE TEST ===\n');
    
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
      const sum = sig1() + sig2() + sig3();
      console.log(`Signal effect #${signalEffectRuns}: sum = ${sum}`);
    });
    
    // Effect depending on computeds
    effect(() => {
      computedEffectRuns++;
      const sum = comp1() + comp2() + comp3();
      console.log(`Computed effect #${computedEffectRuns}: sum = ${sum}`);
    });
    
    expect(signalEffectRuns).toBe(1);
    expect(computedEffectRuns).toBe(1);
    
    console.log('\nChanging only sig1 from 5 to 10...');
    sig1(10);
    
    // Signal effect runs because sig1 is dirty
    expect(signalEffectRuns).toBe(2);
    
    // For computed effect: comp1 re-evaluates, clears dirty flag (value unchanged)
    // But comp2 and comp3 were NEVER re-evaluated, so they still have dirty=true from initial run!
    expect(computedEffectRuns).toBe(1); // Should be 1, but will be 2 due to bug
    
    console.log(`\nResult: Signal effect ran (expected), computed effect ${computedEffectRuns === 1 ? 'did NOT run (correct!)' : 'ran (BUG!)'}`);
  });
});