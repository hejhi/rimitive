/**
 * Scaling Subscribers Benchmark
 * 
 * Tests fan-out scalability - single source driving many subscribers.
 * Key metric: O(1) per-edge overhead as subscriber count increases.
 * Tests memory efficiency of intrusive data structures vs allocations.
 */

import { bench, group, summary, barplot, do_not_optimize } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';

// Type for mitata benchmark state
interface BenchState {
  get(name: 'sources'): number;
  get(name: string): unknown;
}

import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { signal as alienSignal, computed as alienComputed, effect as alienEffect } from 'alien-signals';
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

group('Fan-out Scaling - Single Source to Many', () => {
  summary(() => {
    const ITERATIONS_PER_SUBSCRIBER = 1000; // Keep total work constant
    
    barplot(() => {
      bench('Preact - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');
        
        // Single source driving many subscribers
        const source = preactSignal(0);
        
        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) => 
          preactComputed(() => {
            const val = source.value;
            // Different computation per subscriber to prevent optimization
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );
        
        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({ value: 0 }));
        const disposers = computeds.map((c, i) => 
          preactEffect(() => {
            counters[i]!.value += c.value;
          })
        );
        
        // Warmup
        source.value = 1;
        
        yield () => {
          const iterations = ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
          for (let i = 0; i < iterations; i++) {
            source.value = i;
          }
          return do_not_optimize(counters[0]!.value);
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [10, 25, 50, 100, 200]);
    
      bench('Lattice - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');
        
        // Single source driving many subscribers
        const source = latticeSignal(0);
        
        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) => 
          latticeComputed(() => {
            const val = source();
            // Different computation per subscriber
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );
        
        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({ value: 0 }));
        const disposers = computeds.map((c, i) => 
          latticeEffect(() => {
            counters[i]!.value += c();
          })
        );
        
        // Warmup
        source(1);
        
        yield () => {
          const iterations = ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
          for (let i = 0; i < iterations; i++) {
            source(i);
          }
          return do_not_optimize(counters[0]!.value);
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [10, 25, 50, 100, 200]);
    
      bench('Alien - $sources subscribers', function* (state: BenchState) {
        const subscriberCount = state.get('sources');
        
        // Single source driving many subscribers
        const source = alienSignal(0);
        
        // Create subscribers with varying computations
        const computeds = Array.from({ length: subscriberCount }, (_, i) => 
          alienComputed(() => {
            const val = source();
            // Different computation per subscriber
            let result = val;
            for (let j = 0; j < 3; j++) {
              result = (result * (i + 1) + j) % 1000007;
            }
            return result;
          })
        );
        
        // Effects that consume the computeds
        const counters = Array.from({ length: subscriberCount }, () => ({ value: 0 }));
        const disposers = computeds.map((c, i) => 
          alienEffect(() => {
            counters[i]!.value += c();
          })
        );
        
        // Warmup
        source(1);
        
        yield () => {
          const iterations = ITERATIONS_PER_SUBSCRIBER * Math.sqrt(subscriberCount);
          for (let i = 0; i < iterations; i++) {
            source(i);
          }
          return do_not_optimize(counters[0]!.value);
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [10, 25, 50, 100, 200]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();