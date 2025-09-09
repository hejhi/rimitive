/**
 * Computed Chain Observe/Unobserve Benchmarks
 * 
 * Tests the cost of repeatedly observing and unobserving deep computed chains.
 * This pattern happens in:
 * - Components that mount/unmount frequently (modals, tabs)
 * - Virtual scrolling where items enter/leave viewport
 * - Conditional rendering based on user interaction
 * - Polling UIs that briefly display computed values
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';

import { createComputedContext } from './helpers/createComputedCtx';

const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory
  },
  createComputedContext()
);

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;
const latticeEffect = latticeAPI.effect;

const CHAIN_DEPTH = 10;
const CYCLES = 1000;

group('Computed Chain - Observe/Unobserve Cycles', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - shallow chain (3 levels)', function* () {
        const source = latticeSignal(0);
        const comp1 = latticeComputed(() => source() * 2);
        const comp2 = latticeComputed(() => comp1() + 1);
        const comp3 = latticeComputed(() => comp2() * 3);
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = latticeEffect(() => {
              dummy += comp3();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });

      bench('Alien - shallow chain (3 levels)', function* () {
        const source = alienSignal(0);
        const comp1 = alienComputed(() => source() * 2);
        const comp2 = alienComputed(() => comp1() + 1);
        const comp3 = alienComputed(() => comp2() * 3);
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = alienEffect(() => {
              dummy += comp3();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });

      bench('Preact - shallow chain (3 levels)', function* () {
        const source = preactSignal(0);
        const comp1 = preactComputed(() => source.value * 2);
        const comp2 = preactComputed(() => comp1.value + 1);
        const comp3 = preactComputed(() => comp2.value * 3);
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = preactEffect(() => {
              dummy += comp3.value;
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });
    
      bench('Lattice - deep chain (10 levels)', function* () {
        const source = latticeSignal(0);
        let last: (() => number) = source;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = latticeEffect(() => {
              dummy += final();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });
    
      bench('Alien - deep chain (10 levels)', function* () {
        const source = alienSignal(0);
        let last = source;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = alienComputed(() => prev() + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = alienEffect(() => {
              dummy += final();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });

      bench('Preact - deep chain (10 levels)', function* () {
        const source = preactSignal(0);
        let last = source;
        for (let i = 0; i < CHAIN_DEPTH; i++) {
          const prev = last;
          last = preactComputed(() => prev.value + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES; i++) {
            // Subscribe
            const dispose = preactEffect(() => {
              dummy += final.value;
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });

      bench('Lattice - very deep chain (20 levels)', function* () {
        const source = latticeSignal(0);
        let last: (() => number) = source;
        for (let i = 0; i < 20; i++) {
          const prev = last;
          last = latticeComputed(() => prev() + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES / 10; i++) {
            // Subscribe
            const dispose = latticeEffect(() => {
              dummy += final();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });
    
      bench('Alien - very deep chain (20 levels)', function* () {
        const source = alienSignal(0);
        let last = source;
        for (let i = 0; i < 20; i++) {
          const prev = last;
          last = alienComputed(() => prev() + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES / 10; i++) {
            // Subscribe
            const dispose = alienEffect(() => {
              dummy += final();
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });

      bench('Preact - very deep chain (20 levels)', function* () {
        const source = preactSignal(0);
        let last = source;
        for (let i = 0; i < 20; i++) {
          const prev = last;
          last = preactComputed(() => prev.value + i);
        }
        const final = last;
        
        let dummy = 0;
        
        yield () => {
          for (let i = 0; i < CYCLES / 10; i++) {
            // Subscribe
            const dispose = preactEffect(() => {
              dummy += final.value;
            });
            // Immediately unsubscribe
            dispose();
          }
          return dummy;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();