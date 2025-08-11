/**
 * Subscription Throughput Benchmarks
 *
 * Measures how the systems scale with many subscribers when only a
 * fraction of sources actually change per tick. Lower change ratios
 * should result in fewer effect invocations and better throughput.
 */

import { run, bench, group, boxplot } from 'mitata';

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

// Removed fixed constants - now parameterized via BenchState

function makeIndices(total: number, ratio: number): number[] {
  const count = Math.max(1, Math.floor(total * ratio));
  const idx: number[] = [];
  for (let i = 0; i < count; i++) idx.push((i * 997) % total); // pseudo-randomized but deterministic
  return idx;
}

boxplot(() => {
  group('Subscription Throughput - no changes', () => {
    bench('Preact - sources: $sources, ticks: $ticks', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const indices = makeIndices(sourceCount, 0);

      const sources = Array.from({ length: sourceCount }, (_, i) => preactSignal(i));
      const computeds = sources.map((s) => preactComputed(() => s.value));
      const disposers = computeds.map((c) => preactEffect(() => void c.value));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            // no index updated
            void i;
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200]);

    bench('Lattice - sources: $sources, ticks: $ticks', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const indices = makeIndices(sourceCount, 0);

      const sources = Array.from({ length: sourceCount }, (_, i) => latticeSignal(i));
      const computeds = sources.map((s) => latticeComputed(() => s.value));
      const disposers = computeds.map((c) => latticeEffect(() => void c.value));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            void i;
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200]);

    bench('Alien - sources: $sources, ticks: $ticks', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const indices = makeIndices(sourceCount, 0);

      const sources = Array.from({ length: sourceCount }, (_, i) => alienSignal(i));
      const computeds = sources.map((s) => alienComputed(() => s()));
      const disposers = computeds.map((c) => alienEffect(() => void c()));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            void i;
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200]);
  });
});

boxplot(() => {
  group('Subscription Throughput - variable change ratios', () => {
    bench('Preact - sources: $sources, ticks: $ticks, ratio: $ratio', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const ratio = state.get('ratio');
      const indices = makeIndices(sourceCount, ratio);

      const sources = Array.from({ length: sourceCount }, (_, i) => preactSignal(i));
      const computeds = sources.map((s) => preactComputed(() => s.value));
      const disposers = computeds.map((c) => preactEffect(() => void c.value));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            sources[i]!.value = t + i;
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200])
    .args('ratio', [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]);

    bench('Lattice - sources: $sources, ticks: $ticks, ratio: $ratio', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const ratio = state.get('ratio');
      const indices = makeIndices(sourceCount, ratio);

      const sources = Array.from({ length: sourceCount }, (_, i) => latticeSignal(i));
      const computeds = sources.map((s) => latticeComputed(() => s.value));
      const disposers = computeds.map((c) => latticeEffect(() => void c.value));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            sources[i]!.value = t + i;
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200])
    .args('ratio', [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]);

    bench('Alien - sources: $sources, ticks: $ticks, ratio: $ratio', function* (state: BenchState) {
      const sourceCount = state.get('sources');
      const ticks = state.get('ticks');
      const ratio = state.get('ratio');
      const indices = makeIndices(sourceCount, ratio);

      const sources = Array.from({ length: sourceCount }, (_, i) => alienSignal(i));
      const computeds = sources.map((s) => alienComputed(() => s()));
      const disposers = computeds.map((c) => alienEffect(() => void c()));
      
      yield () => {
        for (let t = 0; t < ticks; t++) {
          for (const i of indices) {
            sources[i]!(t + i);
          }
        }
      };
      
      disposers.forEach((d) => d());
    })
    .args('sources', [100, 200, 400])
    .args('ticks', [50, 100, 200])
    .args('ratio', [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]);
  });
});


// Run all benchmarks with markdown output for better visualization
await run({ format: 'markdown' });
