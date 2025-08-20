import { describe, it, expect, beforeEach } from 'vitest';
import { createTestInstance } from './test-setup';

describe('Debug Dirty Flag Issue', () => {
  let ctx: ReturnType<typeof createTestInstance>;

  beforeEach(() => {
    ctx = createTestInstance();
  });

  it('should debug dirty flag propagation in wide fanout', () => {
    const { signal, computed, effect } = ctx;
    
    const source = signal(5);
    let effectRuns = 0;
    let totalComputeRuns = 0;
    
    // Create 10 computed values (smaller than 100 for easier debugging)
    const computeds = [];
    for (let i = 0; i < 10; i++) {
      computeds[i] = computed(() => {
        totalComputeRuns++;
        console.log(`Computed ${i} running, source =`, source(), 'returning', source() > 0 ? 1 : 0);
        return source() > 0 ? 1 : 0;
      });
    }
    
    // Effect that reads all computeds
    effect(() => {
      effectRuns++;
      console.log(`Effect run #${effectRuns} starting`);
      const sum = computeds.reduce((acc, c, i) => {
        const val = c();
        console.log(`  Reading computed ${i}: ${val}`);
        return acc + val;
      }, 0);
      console.log(`Effect run #${effectRuns} finished, sum = ${sum}`);
    });

    console.log('Initial state - effectRuns:', effectRuns, 'totalComputeRuns:', totalComputeRuns);
    
    // Change source but computed outputs stay the same
    console.log('\n--- Changing source from 5 to 10 ---');
    source(10);
    
    console.log('After change - effectRuns:', effectRuns, 'totalComputeRuns:', totalComputeRuns);
    
    expect(effectRuns).toBe(1); // Should only run once
  });
});