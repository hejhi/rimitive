/**
 * Test to demonstrate the difference between:
 * 1. "Shared context" - signals created from same API instance (what benchmark measures)
 * 2. "Isolated signals" - truly independent signals (what optimization targets)
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
type LatticeExtension<N extends string, M> = { name: N; method: M };

const ITERATIONS = 100000;

group('Context Sharing Impact', () => {
  summary(() => {
    barplot(() => {
      
      // SCENARIO 1: Shared context (what the benchmark currently measures)
      // All signals share the same context/API instance
      bench('Shared context - multiple signals', function* () {
        const latticeAPI = createSignalAPI({
          signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
          computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
          batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
          effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
        }, createDefaultContext());
        
        const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
        
        // Create multiple signals in same context
        const signal1 = latticeSignal(0);
        const signal2 = latticeSignal(0);
        const signal3 = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal1.value = i;
          }
        };
      });
      
      // SCENARIO 2: Truly isolated signal
      // Signal created in its own fresh context
      bench('Isolated context - single signal', function* () {
        const latticeAPI = createSignalAPI({
          signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
          computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
          batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
          effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
        }, createDefaultContext());
        
        const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
        const signal = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
      
      // SCENARIO 3: The actual optimized path
      // Signal with truly no subscribers (what the early return targets)
      bench('Optimized path - no subscribers', function* () {
        const latticeAPI = createSignalAPI({
          signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
          computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
          batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
          effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
        }, createDefaultContext());
        
        const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
        const signal = latticeSignal(0);
        
        // Verify no subscribers
        console.log('Has subscribers?', (signal as any)._out !== undefined);
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
      });
      
      // SCENARIO 4: With subscriber (to show the difference)
      bench('With subscriber - for comparison', function* () {
        const latticeAPI = createSignalAPI({
          signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
          computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
          batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
          effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
        }, createDefaultContext());
        
        const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
        const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;
        
        const signal = latticeSignal(0);
        const dispose = latticeEffect(() => {
          signal.value; // Create a subscriber
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
        
        dispose();
      });
    });
  });
});

// Run benchmarks
await runBenchmark();