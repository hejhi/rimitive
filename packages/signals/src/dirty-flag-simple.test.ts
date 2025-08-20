import { describe, it, expect } from 'vitest';
import { signal, computed, effect } from './test-setup';

describe('Dirty Flag Issue - Simple Demo', () => {
  it('should NOT run effect when computed value does not change', () => {
    console.log('\n=== SIMPLE DIRTY FLAG TEST ===\n');
    
    // Create a signal
    const source = signal(5);
    console.log('1. Created signal with value 5');
    
    // Create a computed that normalizes the value
    const normalized = computed(() => {
      const value = source();
      const result = value > 0 ? 1 : 0;
      console.log(`  Computed running: source=${value}, returning ${result}`);
      return result;
    });
    
    // Create an effect that depends on the computed
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      const value = normalized();
      console.log(`  Effect running (run #${effectRuns}): normalized=${value}`);
    });
    
    console.log('\n2. Initial setup complete:');
    console.log(`  - Effect has run ${effectRuns} time(s)`);
    expect(effectRuns).toBe(1);
    
    console.log('\n3. Changing signal from 5 to 10 (both > 0, so computed should still return 1)');
    source(10);
    
    console.log(`\n4. After signal change:`);
    console.log(`  - Effect has run ${effectRuns} time(s)`);
    console.log(`  - Expected: 1 (effect should NOT run - computed value didn't change)`);
    console.log(`  - Actual: ${effectRuns}`);
    
    // THE BUG: Effect runs even though computed value didn't change!
    expect(effectRuns).toBe(1); // This will fail - effectRuns is 2
  });

  it('should NOT run effect when multiple computeds do not change', () => {
    console.log('\n=== MULTIPLE COMPUTEDS TEST ===\n');
    
    const source = signal(5);
    
    // Create 3 computeds that all normalize the same way
    const comp1 = computed(() => source() > 0 ? 1 : 0);
    const comp2 = computed(() => source() > 0 ? 1 : 0);
    const comp3 = computed(() => source() > 0 ? 1 : 0);
    
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      const sum = comp1() + comp2() + comp3();
      console.log(`Effect run #${effectRuns}: sum = ${sum}`);
    });
    
    expect(effectRuns).toBe(1);
    console.log('Initial: effect ran once, sum = 3');
    
    console.log('Changing signal from 5 to 10...');
    source(10);
    
    console.log(`Effect ran ${effectRuns} times total`);
    console.log('Bug: Even though all computeds still return 1, effect runs again!');
    
    expect(effectRuns).toBe(1); // Fails - it's 2
  });
});