/**
 * Dense Updates Benchmark
 * 
 * Tests performance when a large fraction of signals change per tick.
 * This simulates scenarios with high update frequency like animations,
 * real-time data feeds, or game state updates.
 */

import { run, bench, group, summary, barplot, do_not_optimize } from 'mitata';
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

group('Dense Updates (50-100% change rate)', () => {
  summary(() => {
    const SOURCE_COUNT = 100;
    const TICKS = 50;
    
    function makeIndices(ratio: number): number[] {
      const count = Math.floor(SOURCE_COUNT * ratio);
      const indices: number[] = [];
      for (let i = 0; i < count; i++) {
        indices.push(Math.floor(i * (SOURCE_COUNT / count)));
      }
      return indices;
    }
    
    barplot(() => {
      bench('Preact - $changeRatio% dense updates', function* (state: BenchState) {
        const changeRatio = state.get('changeRatio') / 100;
        const indices = makeIndices(changeRatio);
        
        const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => preactSignal(i));
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
      .args('changeRatio', [50, 75, 90, 100])
      .gc('inner');
    
      bench('Lattice - $changeRatio% dense updates', function* (state: BenchState) {
        const changeRatio = state.get('changeRatio') / 100;
        const indices = makeIndices(changeRatio);
        
        const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => latticeSignal(i));
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
      .args('changeRatio', [50, 75, 90, 100])
      .gc('inner');
    
      bench('Alien - $changeRatio% dense updates', function* (state: BenchState) {
        const changeRatio = state.get('changeRatio') / 100;
        const indices = makeIndices(changeRatio);
        
        const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => alienSignal(i));
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
      .args('changeRatio', [50, 75, 90, 100])
      .gc('inner');
    });
  });
});

// Run all benchmarks
const format = process.env.BENCHMARK_FORMAT === 'json' 
  ? { json: { debug: false, samples: false } }
  : undefined;

const results = await run({ format });

if (process.env.BENCHMARK_FORMAT === 'json') {
  console.log(JSON.stringify(results, null, 2));
}