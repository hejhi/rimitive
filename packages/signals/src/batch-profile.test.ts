import { describe, it } from 'vitest';
import { signal, computed, batch } from './test-setup';

describe('Batch Performance Profile', () => {
  it('profile batch operations', () => {
    const s1 = signal(0);
    const s2 = signal(0);
    const s3 = signal(0);
    const sum = computed(() => s1() + s2() + s3());
    
    // Warm up
    for (let i = 0; i < 100; i++) {
      batch(() => {
        s1(i);
        s2(i * 2);
        s3(i * 3);
      });
      sum();
    }
    
    // Profile
    console.log('\n=== BATCH PROFILING ===\n');
    
    const iterations = 10000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      batch(() => {
        s1(i);
        s2(i * 2);
        s3(i * 3);
      });
      sum();
    }
    
    const end = performance.now();
    const totalMs = end - start;
    const usPerIteration = (totalMs * 1000) / iterations;
    
    console.log(`Total time: ${totalMs.toFixed(2)}ms`);
    console.log(`Per iteration: ${usPerIteration.toFixed(2)}µs`);
    console.log(`Iterations/sec: ${(iterations / (totalMs / 1000)).toFixed(0)}`);
    
    // Now test without batch for comparison
    const start2 = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      s1(i);
      s2(i * 2);
      s3(i * 3);
      sum();
    }
    
    const end2 = performance.now();
    const totalMs2 = end2 - start2;
    const usPerIteration2 = (totalMs2 * 1000) / iterations;
    
    console.log(`\nWithout batch:`);
    console.log(`Total time: ${totalMs2.toFixed(2)}ms`);
    console.log(`Per iteration: ${usPerIteration2.toFixed(2)}µs`);
    console.log(`Iterations/sec: ${(iterations / (totalMs2 / 1000)).toFixed(0)}`);
    
    console.log(`\nBatch overhead: ${((totalMs / totalMs2) * 100 - 100).toFixed(1)}%`);
  });
});