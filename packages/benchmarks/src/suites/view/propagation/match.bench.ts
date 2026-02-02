/**
 * match Overhead & Branch Switching KPIs
 *
 * KPI 1: How much overhead does match add to value propagation?
 * KPI 2: What is the cost of branch switching (condition changes)?
 *
 * These metrics reflect the efficiency of conditional rendering and
 * branch disposal/creation.
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

const PROPAGATION_ITERATIONS = 50_000;
const SWITCH_ITERATIONS = 5_000;

const signalsSvc = compose(SignalModule, ComputedModule, EffectModule);
const { svc: viewSvc, adapter: countingAdapter } = createCountingService();

type BenchState = {
  get(name: 'depth'): number;
  get(name: 'size'): number;
};

// KPI 1: Propagation overhead through match
group('match Propagation Overhead', () => {
  summary(() => {
    barplot(() => {
      bench('pure signals - $depth deep', function* (state: BenchState) {
        const depth = state.get('depth');
        const { signal, computed } = signalsSvc;

        const source = signal(0);
        const show = signal(true);

        let current: () => number = source;
        for (let i = 0; i < depth; i++) {
          const prev = current;
          const level = i;
          current = computed(() => (prev() * 31 + level) % 1_000_007);
        }

        const final = current;
        const conditional = computed(() => (show() ? final() : null));

        source(1);
        void conditional();

        yield () => {
          for (let i = 0; i < PROPAGATION_ITERATIONS; i++) {
            source(i);
            void conditional();
          }
        };
      }).args('depth', [10, 50]);

      bench('through match - $depth deep', function* (state: BenchState) {
        const depth = state.get('depth');
        const { signal, computed, el, match } = viewSvc;

        const source = signal(0);
        const show = signal(true);

        let current: () => number = source;
        for (let i = 0; i < depth; i++) {
          const prev = current;
          const level = i;
          current = computed(() => (prev() * 31 + level) % 1_000_007);
        }

        const final = current;

        const app = el('div')(
          match(show, (visible) => (visible ? el('span')(final) : null))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        source(1);

        yield () => {
          for (let i = 0; i < PROPAGATION_ITERATIONS; i++) {
            source(i);
          }
        };
      }).args('depth', [10, 50]);
    });
  });
});

// KPI 2: Branch switching cost scales with branch complexity
group('match Branch Switch Cost', () => {
  summary(() => {
    barplot(() => {
      bench('switch $size element branch', function* (state: BenchState) {
        const size = state.get('size');
        const { signal, el, match } = viewSvc;

        const show = signal(true);

        const app = el('div')(
          match(show, (visible) => {
            if (!visible) return null;
            const children = Array.from({ length: size }, (_, i) => el('span')(`item-${i}`));
            return el('div')(...children);
          })
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        yield () => {
          for (let i = 0; i < SWITCH_ITERATIONS; i++) {
            show(i % 2 === 0);
          }
        };
      }).args('size', [1, 10, 50]);
    });
  });
});

// KPI 3: Value change without branch switch (baseline comparison)
group('match Value vs Branch Change', () => {
  summary(() => {
    barplot(() => {
      bench('value change (no switch)', function* () {
        const { signal, el, match } = viewSvc;

        const show = signal(true);
        const value = signal(0);

        const app = el('div')(
          match(show, (visible) => (visible ? el('span')(value) : null))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        yield () => {
          for (let i = 0; i < PROPAGATION_ITERATIONS; i++) {
            value(i);
          }
        };
      });

      bench('branch switch', function* () {
        const { signal, el, match } = viewSvc;

        const show = signal(true);

        const app = el('div')(
          match(show, (visible) => (visible ? el('span')('content') : null))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        yield () => {
          for (let i = 0; i < SWITCH_ITERATIONS; i++) {
            show(i % 2 === 0);
          }
        };
      });
    });
  });
});

await runBenchmark();
