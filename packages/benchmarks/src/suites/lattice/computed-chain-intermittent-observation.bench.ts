/**
 * Computed Chain Intermittent Observation Benchmarks
 * 
 * Tests scenarios where computed chains are observed intermittently with value changes
 * between observation periods. This simulates real-world patterns like:
 * - Tab switching with updating data
 * - Modals that open/close while background data changes
 * - Virtualized lists where items scroll in/out while data updates
 * - Dashboard widgets that periodically show/hide
 * 
 * This benchmark demonstrates where preserving dependency chains pays off.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';


import { createBaseContext } from '@lattice/signals/context';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createNodeScheduler } from '@lattice/signals/helpers/node-scheduler';
import { createPushPropagator } from '@lattice/signals/helpers/push-propagator';

// Create Lattice API instance
const baseCtx = createBaseContext();
const pullPropagator = createPullPropagator();
const graphEdges = createGraphEdges();
const nodeScheduler = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
const pushPropagator = createPushPropagator();

// Create Lattice API instance
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory
  },
  {
    ...createBaseContext(),
    nodeScheduler,
    graphEdges,
    pushPropagator,
    pullPropagator,
  }
);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void) => () => void;

const CYCLES = 100;
const UPDATES_PER_UNOBSERVE = 10;

group('Computed Chain - Intermittent Observation', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - observe/update/unobserve pattern', function* () {
        // Create a moderately deep chain
        const s1 = latticeSignal(1);
        const s2 = latticeSignal(2);
        const s3 = latticeSignal(3);
        
        const c1 = latticeComputed(() => s1() + s2());
        const c2 = latticeComputed(() => c1() * s3());
        const c3 = latticeComputed(() => c2() + c1());
        const c4 = latticeComputed(() => c3() * 2);
        const c5 = latticeComputed(() => c4() + c3() + c2());
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // 1. Subscribe and read initial value
            const dispose = latticeEffect(() => {
              result = c5();
            });
            
            // 2. Unsubscribe (simulating tab switch, modal close, etc.)
            dispose();
            
            // 3. Values change while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              s1(s1() + 1);
              s2(s2() + 1);
              s3(s3() + 1);
            }
            
            // 4. Re-subscribe (user returns to tab/modal)
            const dispose2 = latticeEffect(() => {
              result = c5();
            });
            
            // 5. Clean up
            dispose2();
          }
          return result;
        };
      });

      bench('Alien - observe/update/unobserve pattern', function* () {
        // Create same chain structure
        const s1 = alienSignal(1);
        const s2 = alienSignal(2);
        const s3 = alienSignal(3);
        
        const c1 = alienComputed(() => s1() + s2());
        const c2 = alienComputed(() => c1() * s3());
        const c3 = alienComputed(() => c2() + c1());
        const c4 = alienComputed(() => c3() * 2);
        const c5 = alienComputed(() => c4() + c3() + c2());
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // 1. Subscribe and read initial value
            const dispose = alienEffect(() => {
              result = c5();
            });
            
            // 2. Unsubscribe (simulating tab switch, modal close, etc.)
            dispose();
            
            // 3. Values change while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              s1(s1() + 1);
              s2(s2() + 1);
              s3(s3() + 1);
            }
            
            // 4. Re-subscribe (user returns to tab/modal)
            const dispose2 = alienEffect(() => {
              result = c5();
            });
            
            // 5. Clean up
            dispose2();
          }
          return result;
        };
      });

      bench('Preact - observe/update/unobserve pattern', function* () {
        // Create same chain structure
        const s1 = preactSignal(1);
        const s2 = preactSignal(2);
        const s3 = preactSignal(3);
        
        const c1 = preactComputed(() => s1.value + s2.value);
        const c2 = preactComputed(() => c1.value * s3.value);
        const c3 = preactComputed(() => c2.value + c1.value);
        const c4 = preactComputed(() => c3.value * 2);
        const c5 = preactComputed(() => c4.value + c3.value + c2.value);
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // 1. Subscribe and read initial value
            const dispose = preactEffect(() => {
              result = c5.value;
            });
            
            // 2. Unsubscribe (simulating tab switch, modal close, etc.)
            dispose();
            
            // 3. Values change while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              s1.value = s1.value + 1;
              s2.value = s2.value + 1;
              s3.value = s3.value + 1;
            }
            
            // 4. Re-subscribe (user returns to tab/modal)
            const dispose2 = preactEffect(() => {
              result = c5.value;
            });
            
            // 5. Clean up
            dispose2();
          }
          return result;
        };
      });

      bench('Lattice - deep chain with conditional deps', function* () {
        // More complex scenario with conditional dependencies
        const flag = latticeSignal(true);
        const a = latticeSignal(1);
        const b = latticeSignal(10);
        
        const c1 = latticeComputed(() => flag() ? a() * 2 : b() * 3);
        const c2 = latticeComputed(() => c1() + (flag() ? 100 : 200));
        const c3 = latticeComputed(() => c2() * (flag() ? a() : b()));
        const c4 = latticeComputed(() => c3() + c2() + c1());
        const c5 = latticeComputed(() => flag() ? c4() * 2 : c4() / 2);
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // Subscribe
            const dispose = latticeEffect(() => {
              result = c5();
            });
            
            // Unsubscribe
            dispose();
            
            // Change values and toggle flag while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              a(a() + 1);
              b(b() + 1);
              if (i % 3 === 0) flag(!flag());
            }
            
            // Re-subscribe with different dependency paths
            const dispose2 = latticeEffect(() => {
              result = c5();
            });
            
            dispose2();
          }
          return result;
        };
      });

      bench('Alien - deep chain with conditional deps', function* () {
        // Same complex scenario
        const flag = alienSignal(true);
        const a = alienSignal(1);
        const b = alienSignal(10);
        
        const c1 = alienComputed(() => flag() ? a() * 2 : b() * 3);
        const c2 = alienComputed(() => c1() + (flag() ? 100 : 200));
        const c3 = alienComputed(() => c2() * (flag() ? a() : b()));
        const c4 = alienComputed(() => c3() + c2() + c1());
        const c5 = alienComputed(() => flag() ? c4() * 2 : c4() / 2);
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // Subscribe
            const dispose = alienEffect(() => {
              result = c5();
            });
            
            // Unsubscribe
            dispose();
            
            // Change values and toggle flag while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              a(a() + 1);
              b(b() + 1);
              if (i % 3 === 0) flag(!flag());
            }
            
            // Re-subscribe with different dependency paths
            const dispose2 = alienEffect(() => {
              result = c5();
            });
            
            dispose2();
          }
          return result;
        };
      });

      bench('Preact - deep chain with conditional deps', function* () {
        // Same complex scenario
        const flag = preactSignal(true);
        const a = preactSignal(1);
        const b = preactSignal(10);
        
        const c1 = preactComputed(() => flag.value ? a.value * 2 : b.value * 3);
        const c2 = preactComputed(() => c1.value + (flag.value ? 100 : 200));
        const c3 = preactComputed(() => c2.value * (flag.value ? a.value : b.value));
        const c4 = preactComputed(() => c3.value + c2.value + c1.value);
        const c5 = preactComputed(() => flag.value ? c4.value * 2 : c4.value / 2);
        
        let result = 0;
        
        yield () => {
          for (let cycle = 0; cycle < CYCLES; cycle++) {
            // Subscribe
            const dispose = preactEffect(() => {
              result = c5.value;
            });
            
            // Unsubscribe
            dispose();
            
            // Change values and toggle flag while unobserved
            for (let i = 0; i < UPDATES_PER_UNOBSERVE; i++) {
              a.value = a.value + 1;
              b.value = b.value + 1;
              if (i % 3 === 0) flag.value = !flag.value;
            }
            
            // Re-subscribe with different dependency paths
            const dispose2 = preactEffect(() => {
              result = c5.value;
            });
            
            dispose2();
          }
          return result;
        };
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();