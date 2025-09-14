/**
 * Batch vs Subscribe Comparison
 *
 * Tests the performance difference between:
 * - Traditional batched effects (scheduled, deferred)
 * - Subscribe-based eager updates (immediate, synchronous)
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createSubscribeFactory } from '@lattice/signals/subscribe';
import { createComputedContext } from './helpers/createComputedCtx';

const ITERATIONS = 10000;

group('Batch vs Subscribe - Simple Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - Batched Effects', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            effect: createEffectFactory,
            batch: createBatchFactory
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const effect = latticeAPI.effect;
        const batch = latticeAPI.batch;

        const s1 = signal(0);
        const s2 = signal(0);
        const s3 = signal(0);
        const sum = computed(() => s1() + s2() + s3());

        let result = 0;
        const dispose = effect(() => {
          result = sum();
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            batch(() => {
              s1(i);
              s2(i * 2);
              s3(i * 3);
            });
          }
        };

        dispose();
      });

      bench('Lattice - Subscribe (Eager)', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            subscribe: createSubscribeFactory,
            batch: createBatchFactory
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const subscribe = latticeAPI.subscribe;
        const batch = latticeAPI.batch;

        const s1 = signal(0);
        const s2 = signal(0);
        const s3 = signal(0);
        const sum = computed(() => s1() + s2() + s3());

        let result = 0;
        const unsubscribe = subscribe(sum, (val) => {
          result = val;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            batch(() => {
              s1(i);
              s2(i * 2);
              s3(i * 3);
            });
          }
        };

        unsubscribe();
      });

      bench('Lattice - Subscribe (No Batch)', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            subscribe: createSubscribeFactory,
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const subscribe = latticeAPI.subscribe;

        const s1 = signal(0);
        const s2 = signal(0);
        const s3 = signal(0);
        const sum = computed(() => s1() + s2() + s3());

        let result = 0;
        const unsubscribe = subscribe(sum, (val) => {
          result = val;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // No batch - each signal update triggers immediate callback
            s1(i);
            s2(i * 2);
            s3(i * 3);
          }
        };

        unsubscribe();
      });
    });
  });
});

group('Batch vs Subscribe - Complex Graph', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - Batched Effects', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            effect: createEffectFactory,
            batch: createBatchFactory
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const effect = latticeAPI.effect;
        const batch = latticeAPI.batch;

        // Create diamond dependency graph
        const root = signal(0);
        const left = computed(() => root() * 2);
        const right = computed(() => root() + 1);
        const bottom = computed(() => left() + right());

        let result = 0;
        const dispose = effect(() => {
          result = bottom();
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            batch(() => {
              root(i);
            });
          }
        };

        dispose();
      });

      bench('Lattice - Subscribe (Eager)', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            subscribe: createSubscribeFactory,
            batch: createBatchFactory
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const subscribe = latticeAPI.subscribe;
        const batch = latticeAPI.batch;

        // Create diamond dependency graph
        const root = signal(0);
        const left = computed(() => root() * 2);
        const right = computed(() => root() + 1);
        const bottom = computed(() => left() + right());

        let result = 0;
        const unsubscribe = subscribe(bottom, (val) => {
          result = val;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            batch(() => {
              root(i);
            });
          }
        };

        unsubscribe();
      });

      bench('Lattice - Multiple Subscriptions', function* () {
        const ctx = createComputedContext();
        const latticeAPI = createSignalAPI(
          {
            signal: createSignalFactory,
            computed: createComputedFactory,
            subscribe: createSubscribeFactory,
            batch: createBatchFactory
          },
          ctx
        );

        const signal = latticeAPI.signal;
        const computed = latticeAPI.computed;
        const subscribe = latticeAPI.subscribe;
        const batch = latticeAPI.batch;

        // Create diamond dependency graph
        const root = signal(0);
        const left = computed(() => root() * 2);
        const right = computed(() => root() + 1);
        const bottom = computed(() => left() + right());

        let result1 = 0, result2 = 0, result3 = 0;

        // Multiple subscriptions to different nodes
        const unsub1 = subscribe(left, (val) => { result1 = val; });
        const unsub2 = subscribe(right, (val) => { result2 = val; });
        const unsub3 = subscribe(bottom, (val) => { result3 = val; });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            batch(() => {
              root(i);
            });
          }
        };

        unsub1();
        unsub2();
        unsub3();
      });
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();