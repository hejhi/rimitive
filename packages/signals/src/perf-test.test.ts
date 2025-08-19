import { describe, it, expect } from 'vitest';
import { signal, resetGlobalState } from './test-setup';

describe('Performance test', () => {
  it('measure write performance with no subscribers', () => {
    resetGlobalState();
    
    const s = signal(0);
    
    // Verify no subscribers
    console.log('Has subscribers?', (s as any)._out);
    
    // Warm up
    for (let i = 0; i < 100; i++) {
      s.value = i;
    }
    
    // Measure
    const iterations = 100000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      s.value = i;
    }
    
    const end = performance.now();
    const timeMs = end - start;
    const timePerIterationUs = (timeMs * 1000) / iterations;
    
    console.log(`\nWrite performance (no subscribers):`);
    console.log(`  Total time: ${timeMs.toFixed(2)}ms`);
    console.log(`  Per iteration: ${timePerIterationUs.toFixed(2)}µs`);
    console.log(`  Iterations/sec: ${(iterations / (timeMs / 1000)).toFixed(0)}`);
    
    // This should be very fast with the optimization
    expect(timePerIterationUs).toBeLessThan(1); // Less than 1µs per write
  });
});