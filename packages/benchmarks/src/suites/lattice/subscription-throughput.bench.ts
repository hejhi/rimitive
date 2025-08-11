/**
 * Subscription Throughput Benchmarks
 *
 * Measures how the systems scale with many subscribers when only a
 * fraction of sources actually change per tick. Tests the efficiency
 * of change propagation when most signals remain unchanged.
 */

import { run, bench, group } from 'mitata';

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

function makeIndices(total: number, ratio: number): number[] {
  const count = Math.floor(total * ratio);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.floor(i * (total / count)));
  }
  return indices;
}

group('Subscription Updates', () => {
  bench('Preact - $sources sources, $changeRatio% changes', function* (state: BenchState) {
    const sourceCount = state.get('sources');
    const changeRatio = state.get('changeRatio') / 100;
    const ticks = 100;
    const indices = makeIndices(sourceCount, changeRatio);
    
    const sources = Array.from({ length: sourceCount }, (_, i) => preactSignal(i));
    const computeds = sources.map(s => preactComputed(() => s.value * 2));
    const disposers = computeds.map(c => preactEffect(() => void c.value));
    
    yield () => {
      for (let t = 0; t < ticks; t++) {
        for (const i of indices) {
          sources[i]!.value = t + i;
        }
      }
    };
    
    // Cleanup after measurement
    disposers.forEach(d => d());
  })
  .args('sources', [50, 100, 200])
  .args('changeRatio', [10, 25, 50, 100]);

  bench('Lattice - $sources sources, $changeRatio% changes', function* (state: BenchState) {
    const sourceCount = state.get('sources');
    const changeRatio = state.get('changeRatio') / 100;
    const ticks = 100;
    const indices = makeIndices(sourceCount, changeRatio);
    
    const sources = Array.from({ length: sourceCount }, (_, i) => latticeSignal(i));
    const computeds = sources.map(s => latticeComputed(() => s.value * 2));
    const disposers = computeds.map(c => latticeEffect(() => void c.value));
    
    yield () => {
      for (let t = 0; t < ticks; t++) {
        for (const i of indices) {
          sources[i]!.value = t + i;
        }
      }
    };
    
    // Cleanup after measurement
    disposers.forEach(d => d());
  })
  .args('sources', [50, 100, 200])
  .args('changeRatio', [10, 25, 50, 100]);

  bench('Alien - $sources sources, $changeRatio% changes', function* (state: BenchState) {
    const sourceCount = state.get('sources');
    const changeRatio = state.get('changeRatio') / 100;
    const ticks = 100;
    const indices = makeIndices(sourceCount, changeRatio);
    
    const sources = Array.from({ length: sourceCount }, (_, i) => alienSignal(i));
    const computeds = sources.map(s => alienComputed(() => s() * 2));
    const disposers = computeds.map(c => alienEffect(() => void c()));
    
    yield () => {
      for (let t = 0; t < ticks; t++) {
        for (const i of indices) {
          sources[i]!(t + i);
        }
      }
    };
    
    // Cleanup after measurement
    disposers.forEach(d => d());
  })
  .args('sources', [50, 100, 200])
  .args('changeRatio', [10, 25, 50, 100]);
});

// Run all benchmarks
await run();