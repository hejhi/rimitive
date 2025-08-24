/**
 * Preserved Edges Benefit Benchmarks
 * 
 * Tests scenarios where preserving dependency edges should provide performance benefits.
 * These patterns focus on stable computed chains that are read intermittently
 * without creating new effect objects each time.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';

type LatticeExtension<N extends string, M> = { name: N; method: M };

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void) => () => void>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void) => () => void;

const ITERATIONS = 1000;

group('Preserved Edges Benefits', () => {
  summary(() => {
    barplot(() => {
      
      // Scenario 1: Direct computed reads (no new effects)
      bench('Lattice - polling computed reads', function* () {
        // Build a complex computed chain
        const s1 = latticeSignal(1);
        const s2 = latticeSignal(2);
        const s3 = latticeSignal(3);
        
        const c1 = latticeComputed(() => s1() * 2);
        const c2 = latticeComputed(() => s2() * 3);
        const c3 = latticeComputed(() => s3() * 4);
        const c4 = latticeComputed(() => c1() + c2());
        const c5 = latticeComputed(() => c2() + c3());
        const c6 = latticeComputed(() => c4() * c5());
        const final = latticeComputed(() => c6() + c4() + c5());
        
        let result = 0;
        
        // Create ONE long-lived effect that we toggle
        const observer = latticeEffect(() => {
          result = final();
        });
        observer(); // Dispose to make unobserved
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update sources
            s1(i);
            s2(i * 2);
            s3(i * 3);
            
            // Direct read - computeds rebuild from preserved edges
            result += final();
          }
          return result;
        };
      });

      bench('Alien - polling computed reads', function* () {
        const s1 = alienSignal(1);
        const s2 = alienSignal(2);
        const s3 = alienSignal(3);
        
        const c1 = alienComputed(() => s1() * 2);
        const c2 = alienComputed(() => s2() * 3);
        const c3 = alienComputed(() => s3() * 4);
        const c4 = alienComputed(() => c1() + c2());
        const c5 = alienComputed(() => c2() + c3());
        const c6 = alienComputed(() => c4() * c5());
        const final = alienComputed(() => c6() + c4() + c5());
        
        let result = 0;
        
        // Create ONE long-lived effect that we toggle
        const observer = alienEffect(() => {
          result = final();
        });
        observer(); // Dispose to make unobserved
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update sources
            s1(i);
            s2(i * 2);
            s3(i * 3);
            
            // Direct read - computeds must rebuild edges from scratch
            result += final();
          }
          return result;
        };
      });

      bench('Preact - polling computed reads', function* () {
        const s1 = preactSignal(1);
        const s2 = preactSignal(2);
        const s3 = preactSignal(3);
        
        const c1 = preactComputed(() => s1.value * 2);
        const c2 = preactComputed(() => s2.value * 3);
        const c3 = preactComputed(() => s3.value * 4);
        const c4 = preactComputed(() => c1.value + c2.value);
        const c5 = preactComputed(() => c2.value + c3.value);
        const c6 = preactComputed(() => c4.value * c5.value);
        const final = preactComputed(() => c6.value + c4.value + c5.value);
        
        let result = 0;
        
        // Create ONE long-lived effect that we toggle
        const observer = preactEffect(() => {
          result = final.value;
        });
        observer(); // Dispose to make unobserved
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Update sources
            s1.value = i;
            s2.value = i * 2;
            s3.value = i * 3;
            
            // Direct read
            result += final.value;
          }
          return result;
        };
      });

      // Scenario 2: Stable computed with alternating consumers
      bench('Lattice - alternating consumers', function* () {
        const source = latticeSignal(1);
        
        // Expensive computed that benefits from preserved edges
        const expensive = latticeComputed(() => {
          let sum = 0;
          const base = source();
          for (let i = 0; i < 10; i++) {
            sum += base * i;
          }
          return sum;
        });
        
        const consumer1 = latticeComputed(() => expensive() * 2);
        const consumer2 = latticeComputed(() => expensive() * 3);
        
        let result = 0;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            
            // Alternate between consumers
            // expensive→source edge stays intact
            if (i % 2 === 0) {
              result += consumer1();
            } else {
              result += consumer2();
            }
          }
          return result;
        };
      });

      bench('Alien - alternating consumers', function* () {
        const source = alienSignal(1);
        
        const expensive = alienComputed(() => {
          let sum = 0;
          const base = source();
          for (let i = 0; i < 10; i++) {
            sum += base * i;
          }
          return sum;
        });
        
        const consumer1 = alienComputed(() => expensive() * 2);
        const consumer2 = alienComputed(() => expensive() * 3);
        
        let result = 0;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            
            // Alternate between consumers
            // expensive→source edge gets rebuilt each time?
            if (i % 2 === 0) {
              result += consumer1();
            } else {
              result += consumer2();
            }
          }
          return result;
        };
      });

      bench('Preact - alternating consumers', function* () {
        const source = preactSignal(1);
        
        const expensive = preactComputed(() => {
          let sum = 0;
          const base = source.value;
          for (let i = 0; i < 10; i++) {
            sum += base * i;
          }
          return sum;
        });
        
        const consumer1 = preactComputed(() => expensive.value * 2);
        const consumer2 = preactComputed(() => expensive.value * 3);
        
        let result = 0;
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source.value = i;
            
            // Alternate between consumers
            if (i % 2 === 0) {
              result += consumer1.value;
            } else {
              result += consumer2.value;
            }
          }
          return result;
        };
      });

      // Scenario 3: Reusable effect (same effect object subscribes/unsubscribes)
      bench('Lattice - reusable effect', function* () {
        const s1 = latticeSignal(1);
        const s2 = latticeSignal(2);
        
        const c1 = latticeComputed(() => s1() + s2());
        const c2 = latticeComputed(() => c1() * 2);
        const c3 = latticeComputed(() => c2() + c1());
        
        let result = 0;
        let dispose: (() => void) | null = null;
        
        // Create effect ONCE
        const reusableEffect = () => {
          if (!dispose) {
            dispose = latticeEffect(() => {
              result = c3();
            });
          }
        };
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Subscribe with same effect
            reusableEffect();
            
            // Update values
            s1(i);
            s2(i * 2);
            
            // Unsubscribe
            if (dispose) {
              dispose();
              dispose = null;
            }
          }
          return result;
        };
      });

      bench('Alien - reusable effect', function* () {
        const s1 = alienSignal(1);
        const s2 = alienSignal(2);
        
        const c1 = alienComputed(() => s1() + s2());
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() + c1());
        
        let result = 0;
        let dispose: (() => void) | null = null;
        
        // Create effect ONCE
        const reusableEffect = () => {
          if (!dispose) {
            dispose = alienEffect(() => {
              result = c3();
            });
          }
        };
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Subscribe with same effect
            reusableEffect();
            
            // Update values
            s1(i);
            s2(i * 2);
            
            // Unsubscribe
            if (dispose) {
              dispose();
              dispose = null;
            }
          }
          return result;
        };
      });

      bench('Preact - reusable effect', function* () {
        const s1 = preactSignal(1);
        const s2 = preactSignal(2);
        
        const c1 = preactComputed(() => s1.value + s2.value);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value + c1.value);
        
        let result = 0;
        let dispose: (() => void) | null = null;
        
        // Create effect ONCE
        const reusableEffect = () => {
          if (!dispose) {
            dispose = preactEffect(() => {
              result = c3.value;
            });
          }
        };
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Subscribe with same effect
            reusableEffect();
            
            // Update values
            s1.value = i;
            s2.value = i * 2;
            
            // Unsubscribe
            if (dispose) {
              dispose();
              dispose = null;
            }
          }
          return result;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();