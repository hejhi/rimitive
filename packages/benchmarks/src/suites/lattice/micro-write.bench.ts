/**
 * Micro-benchmark to isolate write performance overhead
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { signal as alienSignal } from 'alien-signals';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';

const ITERATIONS = 100000;

group('Micro Write Analysis', () => {
  summary(() => {
    barplot(() => {
      
      // Test 1: Raw property write (baseline)
      bench('Raw JS object write', function* () {
        const obj = { value: 0, version: 0 };
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            obj.value = i;
            obj.version++;
          }
        };
      });
      
      // Test 2: Lattice signal with manual creation to isolate
      bench('Lattice - isolated signal', function* () {
        // Create a fresh context and API for true isolation
        const ctx = createDefaultContext();
        const factory = createSignalFactory(ctx as any);
        const signal = factory.method(0);
        
        // Verify no subscribers
        console.log('Has _out?', (signal as any)._out !== undefined);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
      
      // Test 3: Check if setter overhead is the issue
      bench('Lattice - direct _value write', function* () {
        const ctx = createDefaultContext();
        const factory = createSignalFactory(ctx as any);
        const signal = factory.method(0) as any;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Bypass the setter, write directly
            if (signal._value !== i) {
              signal._value = i;
              signal._version++;
            }
          }
        };
      });
      
      // Test 4: Alien for comparison
      bench('Alien - writes', function* () {
        const signal = alienSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
      });
      
      // Test 5: Check if the equality check is expensive
      bench('Lattice - no equality check', function* () {
        const ctx = createDefaultContext();
        const factory = createSignalFactory(ctx as any);
        const signal = factory.method(0) as any;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Skip equality check entirely
            signal._value = i;
            signal._version++;
          }
        };
      });
    });
  });
});

// Run benchmarks
await runBenchmark();