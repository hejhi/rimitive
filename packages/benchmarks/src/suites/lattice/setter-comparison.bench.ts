/**
 * Compare setter performance across libraries
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { signal as preactSignal } from '@preact/signals-core';
import { signal as alienSignal } from 'alien-signals';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';

const ITERATIONS = 100000;

group('Setter Performance Comparison', () => {
  summary(() => {
    barplot(() => {
      
      // Preact uses a setter
      bench('Preact - setter writes', function* () {
        const signal = preactSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;  // Uses setter
          }
        };
      });
      
      // Alien uses a function call
      bench('Alien - function writes', function* () {
        const signal = alienSignal(0);
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);  // Direct function call
          }
        };
      });
      
      // Lattice uses a setter
      bench('Lattice - setter writes', function* () {
        const ctx = createDefaultContext();
        const factory = createSignalFactory(ctx);
        const signal = factory.method(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;  // Uses setter
          }
        };
      });
      
      // Let's also test getter performance
      bench('Preact - getter reads', function* () {
        const signal = preactSignal(42);
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;  // Uses getter
          }
          return sum;
        };
      });
      
      bench('Alien - function reads', function* () {
        const signal = alienSignal(42);
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal();  // Function call
          }
          return sum;
        };
      });
      
      bench('Lattice - getter reads', function* () {
        const ctx = createDefaultContext();
        const factory = createSignalFactory(ctx as any);
        const signal = factory.method(42);
        
        yield () => {
          let sum = 0;
          for (let i = 0; i < ITERATIONS; i++) {
            sum += signal.value;  // Uses getter
          }
          return sum;
        };
      });
      
      // Test the actual setter overhead vs direct property
      bench('Plain object - property write', function* () {
        const obj = { value: 0 };
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            obj.value = i;
          }
        };
      });
      
      bench('Object with setter - write', function* () {
        let _value = 0;
        const obj = {
          set value(v: number) { _value = v; },
          get value() { return _value; }
        };
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            obj.value = i;
          }
        };
      });
    });
  });
});

// Run benchmarks
await runBenchmark();