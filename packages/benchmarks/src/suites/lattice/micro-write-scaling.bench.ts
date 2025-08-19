/**
 * Micro Write Scaling Benchmark
 * 
 * Tests signal write performance with varying numbers of subscribers
 * to identify overhead in the write path
 */

import { bench, group } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';

runBenchmark('micro-write-scaling', () => {
  
  group('Write Scaling', () => {
    // Test with 0 subscribers (baseline)
    bench('0 subscribers x1000', function* () {
      const ctx = createDefaultContext();
      const { signal } = createSignalAPI(ctx);
      const source = signal(0);
      
      yield () => {
        for (let i = 0; i < 1000; i++) {
          source.value = i;
        }
      };
    });

    // Test with 1 subscriber
    bench('1 subscriber x1000', function* () {
      const ctx = createDefaultContext();
      const { signal, effect } = createSignalAPI(ctx);
      const source = signal(0);
      const disposer = effect(() => { source.value; });
      
      yield () => {
        for (let i = 0; i < 1000; i++) {
          source.value = i;
        }
      };
      
      disposer();
    });

    // Test with 10 subscribers
    bench('10 subscribers x1000', function* () {
      const ctx = createDefaultContext();
      const { signal, effect } = createSignalAPI(ctx);
      const source = signal(0);
      const disposers = [];
      for (let j = 0; j < 10; j++) {
        disposers.push(effect(() => { source.value; }));
      }
      
      yield () => {
        for (let i = 0; i < 1000; i++) {
          source.value = i;
        }
      };
      
      disposers.forEach(d => d());
    });

    // Test with 100 subscribers
    bench('100 subscribers x1000', function* () {
      const ctx = createDefaultContext();
      const { signal, effect } = createSignalAPI(ctx);
      const source = signal(0);
      const disposers = [];
      for (let j = 0; j < 100; j++) {
        disposers.push(effect(() => { source.value; }));
      }
      
      yield () => {
        for (let i = 0; i < 1000; i++) {
          source.value = i;
        }
      };
      
      disposers.forEach(d => d());
    });
  });

  group('Overhead Components', () => {
    bench('Signal write - no deps x10k', function* () {
      const ctx = createDefaultContext();
      const { signal } = createSignalAPI(ctx);
      const source = signal(0);
      
      yield () => {
        for (let i = 0; i < 10000; i++) {
          source.value = i;
        }
      };
    });
    
    bench('Signal write - same value x10k', function* () {
      const ctx = createDefaultContext();
      const { signal } = createSignalAPI(ctx);
      const source = signal(0);
      
      yield () => {
        for (let i = 0; i < 10000; i++) {
          source.value = 0; // Same value - should early return
        }
      };
    });
  });
});