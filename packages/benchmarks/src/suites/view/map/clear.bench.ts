/**
 * Map Clear Scaling Benchmark
 *
 * Tests list clearing (remove all items) scalability.
 * Key metric: Should be O(n) - must dispose each item.
 *
 * Scaling: 100, 1000, 10000 items
 *
 * This measures:
 * - Element cleanup cost
 * - Scope disposal cost (for items with effects)
 * - Memory release efficiency
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

// Create service once at module level to reduce variance
const { svc: sharedSvc, adapter: sharedAdapter } = createCountingService();

group('Map Clear - Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('clear $size items', function* (state: BenchState<'size'>) {
        const size = state.get('size');
        const { el, map, signal } = sharedSvc;

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
        const ref = app.create(sharedSvc);
        sharedAdapter.appendChild(root, ref.element as CountingNode);

        // Setup: create rows
        data(buildRowData(size, signal));

        // Warmup: run one clear/recreate cycle
        data([]);
        data(buildRowData(size, signal));

        yield () => {
          // Clear all
          data([]);
        };

        // Reset for next iteration - recreate rows
        resetIdCounter();
        data(buildRowData(size, signal));
      }).args('size', LIST_SCALES);
    });
  });
});

// Compare clear vs create at same size
group('Map Clear vs Create - Same Size', () => {
  summary(() => {
    barplot(() => {
      bench('clear 1000', function* () {
        const { el, map, signal } = sharedSvc;

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
        const ref = app.create(sharedSvc);
        sharedAdapter.appendChild(root, ref.element as CountingNode);

        data(buildRowData(1000, signal));

        // Warmup: run one clear/recreate cycle
        data([]);
        data(buildRowData(1000, signal));

        yield () => {
          data([]);
        };

        resetIdCounter();
        data(buildRowData(1000, signal));
      });

      bench('create 1000', function* () {
        const { el, map, signal } = sharedSvc;

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
        const ref = app.create(sharedSvc);
        sharedAdapter.appendChild(root, ref.element as CountingNode);

        const rowData = buildRowData(1000, signal);

        // Warmup: run one create/clear cycle
        data(rowData);
        data([]);

        yield () => {
          data(rowData);
        };

        data([]);
        resetIdCounter();
      });
    });
  });
});

await runBenchmark();
