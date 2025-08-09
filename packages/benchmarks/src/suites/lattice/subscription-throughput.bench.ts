/**
 * Subscription Throughput Benchmarks
 *
 * Measures how the systems scale with many subscribers when only a
 * fraction of sources actually change per tick. Lower change ratios
 * should result in fewer effect invocations and better throughput.
 */

import { describe, bench } from 'vitest';
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

const SOURCE_COUNT = 400; // keep runtime manageable in CI
const TICKS = 200;

function makeIndices(total: number, ratio: number): number[] {
  const count = Math.max(1, Math.floor(total * ratio));
  const idx: number[] = [];
  for (let i = 0; i < count; i++) idx.push((i * 997) % total); // pseudo-randomized but deterministic
  return idx;
}

describe('Subscription Throughput - change ratio 0%', () => {
  const indices = makeIndices(SOURCE_COUNT, 0);

  bench('Preact - no change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => preactSignal(i));
    const computeds = sources.map((s) => preactComputed(() => s.value));
    const disposers = computeds.map((c) => preactEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        // no index updated
        void i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Lattice - no change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => latticeSignal(i));
    const computeds = sources.map((s) => latticeComputed(() => s.value));
    const disposers = computeds.map((c) => latticeEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        void i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Alien - no change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => alienSignal(i));
    const computeds = sources.map((s) => alienComputed(() => s()));
    const disposers = computeds.map((c) => alienEffect(() => void c()));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        void i;
      }
    }
    disposers.forEach((d) => d());
  });
});

describe('Subscription Throughput - change ratio 10%', () => {
  const indices = makeIndices(SOURCE_COUNT, 0.1);

  bench('Preact - 10% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => preactSignal(i));
    const computeds = sources.map((s) => preactComputed(() => s.value));
    const disposers = computeds.map((c) => preactEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!.value = t + i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Lattice - 10% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => latticeSignal(i));
    const computeds = sources.map((s) => latticeComputed(() => s.value));
    const disposers = computeds.map((c) => latticeEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!.value = t + i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Alien - 10% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => alienSignal(i));
    const computeds = sources.map((s) => alienComputed(() => s()));
    const disposers = computeds.map((c) => alienEffect(() => void c()));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!(t + i);
      }
    }
    disposers.forEach((d) => d());
  });
});

describe('Subscription Throughput - change ratio 100%', () => {
  const indices = makeIndices(SOURCE_COUNT, 1);

  bench('Preact - 100% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => preactSignal(i));
    const computeds = sources.map((s) => preactComputed(() => s.value));
    const disposers = computeds.map((c) => preactEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!.value = t + i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Lattice - 100% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => latticeSignal(i));
    const computeds = sources.map((s) => latticeComputed(() => s.value));
    const disposers = computeds.map((c) => latticeEffect(() => void c.value));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!.value = t + i;
      }
    }
    disposers.forEach((d) => d());
  });

  bench('Alien - 100% change', () => {
    const sources = Array.from({ length: SOURCE_COUNT }, (_, i) => alienSignal(i));
    const computeds = sources.map((s) => alienComputed(() => s()));
    const disposers = computeds.map((c) => alienEffect(() => void c()));
    for (let t = 0; t < TICKS; t++) {
      for (const i of indices) {
        sources[i]!(t + i);
      }
    }
    disposers.forEach((d) => d());
  });
});
