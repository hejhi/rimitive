/**
 * map Overhead & Structural KPIs
 *
 * KPI 1: How much overhead does map add to value propagation?
 * KPI 2: What is the cost of structural changes (append, remove, reorder)?
 * KPI 3: Are single-item updates O(1) regardless of list size?
 *
 * These metrics reflect the reconciliation algorithm efficiency and
 * can be improved at the algorithmic level.
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
const STRUCTURAL_ITERATIONS = 1_000;

const signalsSvc = compose(SignalModule, ComputedModule, EffectModule);
const { svc: viewSvc, adapter: countingAdapter } = createCountingService();

type Item = { id: number; value: () => number };

type BenchState = {
  get(name: 'depth'): number;
  get(name: 'size'): number;
};

// KPI 1: Propagation overhead through map
group('map Propagation Overhead', () => {
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
          for (let i = 0; i < PROPAGATION_ITERATIONS; i++) {
            source(i);
            void final();
          }
        };
      }).args('depth', [10, 50]);

      bench('through map - $depth items', function* (state: BenchState) {
        const depth = state.get('depth');
        const { signal, computed, el, map } = viewSvc;

        const source = signal(0);

        // Chain where each item depends on previous
        const items: Item[] = [];
        let prev: () => number = source;
        for (let i = 0; i < depth; i++) {
          const prevCapture = prev;
          const level = i;
          const value = computed(() => (prevCapture() * 31 + level) % 1_000_007);
          items.push({ id: i, value });
          prev = value;
        }

        const data = signal(items);

        const app = el('ul')(
          map(data, (item) => item.id, (itemSig) => el('li')(itemSig().value))
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

// KPI 2: Single-item update is O(1)
group('map Single-Item Update O(1)', () => {
  summary(() => {
    barplot(() => {
      bench('update 1 item in $size list', function* (state: BenchState) {
        const size = state.get('size');
        const { signal, el, map } = viewSvc;

        const items = Array.from({ length: size }, (_, i) => ({
          id: i,
          value: signal(0),
        }));

        const data = signal(items);

        const app = el('ul')(
          map(data, (item) => item.id, (itemSig) => el('li')(itemSig().value))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        items[0]!.value(1);

        yield () => {
          for (let i = 0; i < PROPAGATION_ITERATIONS; i++) {
            // Update single item - should be O(1) regardless of list size
            items[0]!.value(i);
          }
        };
      }).args('size', [10, 100, 1000]);
    });
  });
});

// KPI 3: Structural change costs
group('map Structural - Append', () => {
  summary(() => {
    barplot(() => {
      bench('append 10 to $size list', function* (state: BenchState) {
        const size = state.get('size');
        const { signal, el, map } = viewSvc;

        const base = Array.from({ length: size }, (_, i) => ({ id: i, value: i }));
        const extended = [...base, ...Array.from({ length: 10 }, (_, i) => ({ id: size + i, value: size + i }))];

        const data = signal(base);

        const app = el('ul')(
          map(data, (item) => item.id, (itemSig) => el('li')(String(itemSig().value)))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        data(extended);
        data(base);

        yield () => {
          for (let i = 0; i < STRUCTURAL_ITERATIONS; i++) {
            data(extended);
            data(base);
          }
        };
      }).args('size', [100, 1000]);
    });
  });
});

group('map Structural - Remove', () => {
  summary(() => {
    barplot(() => {
      bench('remove 10 from $size list', function* (state: BenchState) {
        const size = state.get('size');
        const { signal, el, map } = viewSvc;

        const full = Array.from({ length: size }, (_, i) => ({ id: i, value: i }));
        const truncated = full.slice(0, -10);

        const data = signal(full);

        const app = el('ul')(
          map(data, (item) => item.id, (itemSig) => el('li')(String(itemSig().value)))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        data(truncated);
        data(full);

        yield () => {
          for (let i = 0; i < STRUCTURAL_ITERATIONS; i++) {
            data(truncated);
            data(full);
          }
        };
      }).args('size', [100, 1000]);
    });
  });
});

group('map Structural - Reorder', () => {
  summary(() => {
    barplot(() => {
      bench('swap first/last in $size list', function* (state: BenchState) {
        const size = state.get('size');
        const { signal, el, map } = viewSvc;

        const original = Array.from({ length: size }, (_, i) => ({ id: i, value: i }));
        const swapped = [original[size - 1]!, ...original.slice(1, -1), original[0]!];

        const data = signal(original);

        const app = el('ul')(
          map(data, (item) => item.id, (itemSig) => el('li')(String(itemSig().value)))
        );

        const root = createCountingRoot();
        const ref = app.create(viewSvc);
        countingAdapter.appendChild(root, ref.element as CountingNode);

        data(swapped);
        data(original);

        yield () => {
          for (let i = 0; i < STRUCTURAL_ITERATIONS; i++) {
            data(i % 2 === 0 ? swapped : original);
          }
        };
      }).args('size', [100, 1000]);
    });
  });
});

await runBenchmark();
