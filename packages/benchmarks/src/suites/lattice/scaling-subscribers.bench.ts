/**
 * Scaling Subscribers Benchmark
 * 
 * Tests how performance scales with different numbers of subscribers.
 * Evaluates the overhead of managing many active subscriptions and
 * effect triggers across varying graph sizes.
 */

import { bench, group, summary, barplot, do_not_optimize } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { randomIntArray } from '../../utils/bench-helpers';

// Type for mitata benchmark state
interface BenchState {
  get(name: string): any;
}

import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import { signal as alienSignal, computed as alienComputed, effect as alienEffect } from 'alien-signals';

// Lattice API instance
const latticeAPI = createSignalAPI(
  {
    signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
    computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
    effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
  },
  createDefaultContext()
);

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

group('Scaling with Subscriber Count', () => {
  summary(() => {
    const CHANGE_RATIO = 0.3; // 30% of signals change
    const TICKS = 30;
    
    function makeIndices(sourceCount: number): number[] {
      const count = Math.floor(sourceCount * CHANGE_RATIO);
      const indices: number[] = [];
      for (let i = 0; i < count; i++) {
        indices.push(Math.floor(i * (sourceCount / count)));
      }
      return indices;
    }
    
    barplot(() => {
      bench('Preact - $sources subscribers', function* (state: BenchState) {
        const sourceCount = state.get('sources');
        const indices = makeIndices(sourceCount);
        
        const sources = Array.from({ length: sourceCount }, (_, i) => preactSignal(i));
        const computeds = sources.map(s => preactComputed(() => s.value * 2));
        const disposers = computeds.map(c => preactEffect(() => void c.value));
        
        // Warm up
        sources[0]!.value = 1;
        
        yield {
          [0]() { return randomIntArray(TICKS * indices.length, 0, 100000); },
          [1]() { return sources; },
          [2]() { return indices; },
          
          bench(values: number[], sources: any[], indices: number[]) {
            let changeCount = 0;
            let valueIndex = 0;
            for (let t = 0; t < TICKS; t++) {
              for (const i of indices) {
                sources[i]!.value = values[valueIndex++ % values.length]!;
                changeCount++;
              }
            }
            return do_not_optimize(changeCount);
          }
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [25, 50, 100, 200, 400])
      .gc('inner');
    
      bench('Lattice - $sources subscribers', function* (state: BenchState) {
        const sourceCount = state.get('sources');
        const indices = makeIndices(sourceCount);
        
        const sources = Array.from({ length: sourceCount }, (_, i) => latticeSignal(i));
        const computeds = sources.map(s => latticeComputed(() => s.value * 2));
        const disposers = computeds.map(c => latticeEffect(() => void c.value));
        
        // Warm up
        sources[0]!.value = 1;
        
        yield {
          [0]() { return randomIntArray(TICKS * indices.length, 0, 100000); },
          [1]() { return sources; },
          [2]() { return indices; },
          
          bench(values: number[], sources: any[], indices: number[]) {
            let changeCount = 0;
            let valueIndex = 0;
            for (let t = 0; t < TICKS; t++) {
              for (const i of indices) {
                sources[i]!.value = values[valueIndex++ % values.length]!;
                changeCount++;
              }
            }
            return do_not_optimize(changeCount);
          }
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [25, 50, 100, 200, 400])
      .gc('inner');
    
      bench('Alien - $sources subscribers', function* (state: BenchState) {
        const sourceCount = state.get('sources');
        const indices = makeIndices(sourceCount);
        
        const sources = Array.from({ length: sourceCount }, (_, i) => alienSignal(i));
        const computeds = sources.map(s => alienComputed(() => s() * 2));
        const disposers = computeds.map(c => alienEffect(() => void c()));
        
        yield {
          [0]() { return randomIntArray(TICKS * indices.length, 0, 100000); },
          [1]() { return sources; },
          [2]() { return indices; },
          
          bench(values: number[], sources: any[], indices: number[]) {
            let changeCount = 0;
            let valueIndex = 0;
            for (let t = 0; t < TICKS; t++) {
              for (const i of indices) {
                sources[i]!(values[valueIndex++ % values.length]!);
                changeCount++;
              }
            }
            return do_not_optimize(changeCount);
          }
        };
        
        disposers.forEach(d => d());
      })
      .args('sources', [25, 50, 100, 200, 400])
      .gc('inner');
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();