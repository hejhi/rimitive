/**
 * Filter Pattern Benchmark
 *
 * Tests the common "filter list" operation - remove many items, keep some.
 * This is a real-world pattern that combines removal and reconciliation.
 *
 * Key metric: Should be efficient at removing items that don't match filter.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  buildRowData,
  resetIdCounter,
  LIST_SCALES,
  type BenchState,
  type RowData,
  type Reactive,
  type CountingNode,
} from '../deps/counting-harness';

group('Pattern - Filter List', () => {
  summary(() => {
    barplot(() => {
      // Filter to 50% of items
      bench('filter $size to 50%', function* (state: BenchState<'size'>) {
        const size = state.get('size');
        const { svc, adapter } = createCountingService();
        const { el, map, signal } = svc;

        const data = signal<RowData[]>([]);

        const app = el('div')(
          el('table')(
            el('tbody')(
              map(
                data,
                (row: RowData) => row.id,
                (rowSignal: Reactive<RowData>) => {
                  const row = rowSignal();
                  return el('tr')(
                    el('td')(String(row.id)),
                    el('td')(row.label)
                  );
                }
              )
            )
          )
        );

        const root = createCountingRoot();
        const ref = app.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        // Setup: create rows
        const allRows = buildRowData(size, signal);
        data(allRows);

        // Pre-compute filtered arrays
        const halfRows = allRows.filter((_, i) => i % 2 === 0);

        let filtered = false;

        yield () => {
          if (filtered) {
            data(allRows);
            filtered = false;
          } else {
            data(halfRows);
            filtered = true;
          }
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);

      // Filter to 10% of items
      bench('filter $size to 10%', function* (state: BenchState<'size'>) {
        const size = state.get('size');
        const { svc, adapter } = createCountingService();
        const { el, map, signal } = svc;

        const data = signal<RowData[]>([]);

        const app = el('div')(
          el('table')(
            el('tbody')(
              map(
                data,
                (row: RowData) => row.id,
                (rowSignal: Reactive<RowData>) => {
                  const row = rowSignal();
                  return el('tr')(
                    el('td')(String(row.id)),
                    el('td')(row.label)
                  );
                }
              )
            )
          )
        );

        const root = createCountingRoot();
        const ref = app.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        const allRows = buildRowData(size, signal);
        data(allRows);

        const tenPercent = allRows.filter((_, i) => i % 10 === 0);

        let filtered = false;

        yield () => {
          if (filtered) {
            data(allRows);
            filtered = false;
          } else {
            data(tenPercent);
            filtered = true;
          }
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

// Compare filter vs clear+recreate
group('Pattern - Filter vs Clear+Recreate', () => {
  summary(() => {
    barplot(() => {
      bench('filter to 50% (reconcile)', function* () {
        const { svc, adapter } = createCountingService();
        const { el, map, signal } = svc;

        const data = signal<RowData[]>([]);

        const app = el('div')(
          map(
            data,
            (row: RowData) => row.id,
            (rowSignal: Reactive<RowData>) => {
              const row = rowSignal();
              return el('div')(row.label);
            }
          )
        );

        const root = createCountingRoot();
        const ref = app.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        const allRows = buildRowData(1000, signal);
        data(allRows);

        const halfRows = allRows.filter((_, i) => i % 2 === 0);

        let filtered = false;

        yield () => {
          data(filtered ? allRows : halfRows);
          filtered = !filtered;
        };

        resetIdCounter();
      });

      bench('clear + recreate 50% (no reconcile)', function* () {
        const { svc, adapter } = createCountingService();
        const { el, map, signal } = svc;

        const data = signal<RowData[]>([]);

        const app = el('div')(
          map(
            data,
            (row: RowData) => row.id,
            (rowSignal: Reactive<RowData>) => {
              const row = rowSignal();
              return el('div')(row.label);
            }
          )
        );

        const root = createCountingRoot();
        const ref = app.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let useAll = true;

        yield () => {
          // Clear and recreate with new IDs each time (forces full recreation)
          resetIdCounter();
          const rows = buildRowData(useAll ? 1000 : 500, signal);
          data(rows);
          useAll = !useAll;
        };
      });
    });
  });
});

await runBenchmark();
