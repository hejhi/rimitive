/**
 * el Propagation Overhead
 *
 * KPI: How much overhead does the el primitive add to signal propagation?
 *
 * Measures the cost of scopedEffect wrappers that bind reactive values to
 * the view tree. This is the fundamental overhead of the view layer.
 *
 * Observable: Time per source update to propagate through computed chain
 * and trigger view binding effects.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  type CountingNode,
} from '../deps/counting-harness';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

const ITERATIONS = 50_000;

const signalsSvc = compose(SignalModule, ComputedModule, EffectModule);
const { svc: viewSvc, adapter: countingAdapter } = createCountingService();

type BenchState = {
  get(name: 'depth'): number;
  get(name: 'bindings'): number;
};

// KPI 1: Propagation overhead at varying depths
group('el Propagation Overhead', () => {
  summary(() => {
    barplot(() => {
      bench('pure signals - $depth deep', function* (state: BenchState) {
        const depth = state.get('depth');
        const { signal, computed } = signalsSvc;

        const source = signal(0);
        let current: () => number = source;

        for (let i = 0; i < depth; i++) {
          const prev = current;
          const level = i;
          current = computed(() => (prev() * 31 + level) % 1_000_007);
        }

        const final = current;
        source(1);
        void final();

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      }).args('depth', [10, 50]);

      bench('el binding - $depth deep', function* (state: BenchState) {
        const depth = state.get('depth');
        const { signal, computed, el } = viewSvc;

        const source = signal(0);
        let current: () => number = source;

        for (let i = 0; i < depth; i++) {
          const prev = current;
          const level = i;
          current = computed(() => (prev() * 31 + level) % 1_000_007);
        }

        const app = el('div')(el('span')(current));

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        source(1);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
          }
        };
      }).args('depth', [10, 50]);
    });
  });
});

// KPI 2: Overhead scales linearly with binding count
group('el Binding Count Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('$bindings bindings on 50-deep chain', function* (state: BenchState) {
        const bindingCount = state.get('bindings');
        const { signal, computed, el } = viewSvc;

        const source = signal(0);
        const chain: Array<() => number> = [source];

        for (let i = 0; i < 50; i++) {
          const prev = chain[chain.length - 1]!;
          const level = i;
          chain.push(computed(() => (prev() * 31 + level) % 1_000_007));
        }

        // Bind evenly spaced nodes
        const step = Math.floor(50 / bindingCount);
        const bindings = [];
        for (let i = step; i <= 50; i += step) {
          bindings.push(el('span')(chain[i]!));
        }

        const app = el('div')(...bindings);
        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        source(1);

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            source(i);
          }
        };
      }).args('bindings', [1, 5, 25]);
    });
  });
});

await runBenchmark();
