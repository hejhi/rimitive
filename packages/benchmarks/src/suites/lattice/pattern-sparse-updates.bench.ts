/**
 * Sparse Updates Benchmark
 * 
 * Tests performance when only a small fraction of signals change per tick.
 * This simulates real-world scenarios where most state remains stable
 * while only specific parts update (e.g., cursor position, single form field).
 */

import { bench, group, summary, barplot, do_not_optimize } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { randomIntArray } from '../../utils/bench-helpers';

// Type for mitata benchmark state
interface BenchState {
  get(name: 'changeRatio'): number;
  get(name: string): unknown;
}

import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { type SignalFunction } from '@lattice/signals/signal';
import { signal as alienSignal, computed as alienComputed, effect as alienEffect } from 'alien-signals';
import { createApi } from './helpers/signal-computed-effect';

const latticeAPI = createApi();

const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;
const latticeEffect = latticeAPI.effect;

// Signal types for each library
type PreactSignal = { value: number };
type AlienSignal = (value?: number) => number;

group('Sparse Updates (10-25% change rate)', () => {
  summary(() => {
    const SOURCE_COUNT = 100;
    const TICKS = 50;
    
    function makeIndices(ratio: number): number[] {
      const count = Math.floor(SOURCE_COUNT * ratio);
      const indices: number[] = [];
      // Spread changes evenly across the signal array
      for (let i = 0; i < count; i++) {
        indices.push(Math.floor(i * (SOURCE_COUNT / count)));
      }
      return indices;
    }
    
    barplot(() => {
      bench('Preact - $changeRatio% sparse updates', function* (state: BenchState) {
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
          
          bench(values: number[], sources: PreactSignal[], indices: number[]) {
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
      .args('changeRatio', [10, 15, 20, 25])
      .gc('inner');
    
      bench('Lattice - $changeRatio% sparse updates', function* (state: BenchState) {
        const changeRatio = state.get('changeRatio') / 100;
        const indices = makeIndices(changeRatio);
        
        const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => latticeSignal(i));
        const computeds = sources.map(s => latticeComputed(() => s() * 2));
        const disposers = computeds.map(c => latticeEffect(() => void c()));
        
        // Warm up
        sources[0]!(1);
        
        yield {
          [0]() { return randomIntArray(TICKS * indices.length, 0, 100000); },
          [1]() { return sources; },
          [2]() { return indices; },
          
          bench(values: number[], sources: SignalFunction[], indices: number[]) {
            let changeCount = 0;
            let valueIndex = 0;
            for (let t = 0; t < TICKS; t++) {
              for (const i of indices) {
                sources[i]!(values[valueIndex++ % values.length])!;
                changeCount++;
              }
            }
            return do_not_optimize(changeCount);
          }
        };
        
        disposers.forEach(d => d());
      })
      .args('changeRatio', [10, 15, 20, 25])
      .gc('inner');
    
      bench('Alien - $changeRatio% sparse updates', function* (state: BenchState) {
        const changeRatio = state.get('changeRatio') / 100;
        const indices = makeIndices(changeRatio);
        
        const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => alienSignal(i));
        const computeds = sources.map(s => alienComputed(() => s() * 2));
        const disposers = computeds.map(c => alienEffect(() => void c()));
        
        yield {
          [0]() { return randomIntArray(TICKS * indices.length, 0, 100000); },
          [1]() { return sources; },
          [2]() { return indices; },
          
          bench(values: number[], sources: AlienSignal[], indices: number[]) {
            let changeCount = 0;
            let valueIndex = 0;
            for (let t = 0; t < TICKS; t++) {
              for (const i of indices) {
                sources[i]!(values[valueIndex++ % values.length]);
                changeCount++;
              }
            }
            return do_not_optimize(changeCount);
          }
        };
        
        disposers.forEach(d => d());
      })
      .args('changeRatio', [10, 15, 20, 25])
      .gc('inner');
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();