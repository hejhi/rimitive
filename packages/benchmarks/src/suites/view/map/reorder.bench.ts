/**
 * Map Reorder Scaling Benchmark
 *
 * Tests list reordering operations using counting adapter for O(1) adapter ops.
 * Key metric: Should be O(n log n) from LIS algorithm + O(moves) for DOM operations.
 *
 * Scaling: Lists of varying sizes (100, 1000, 10000)
 *
 * Operations tested:
 * - Swap: Exchange two items (2 moves)
 * - Reverse: Reverse entire list (n moves)
 * - Shuffle: Random permutation (n moves)
 *
 * Swap is the js-framework-benchmark classic, but reverse and shuffle
 * stress-test the reconciliation algorithm more thoroughly.
 *
 * Note: Uses counting adapter (not test adapter) to avoid O(n) array operations
 * that would artificially inflate times to O(n²).
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

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

group('Map Reorder - Swap Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('swap 2 items in $size list', function* (state: BenchState<'size'>) {
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

        const baseData = buildRowData(size, signal);
        data(baseData);

        let swapState = 0;
        // Swap positions 1 and near-end (classic js-framework-benchmark)
        const swapIdx = Math.min(998, size - 2);

        // Warmup: perform one swap
        const warmupD = data().slice();
        [warmupD[1], warmupD[swapIdx]] = [warmupD[swapIdx]!, warmupD[1]!];
        data(warmupD);

        yield () => {
          const d = data().slice();
          if (swapState === 0) {
            [d[1], d[swapIdx]] = [d[swapIdx]!, d[1]!];
            swapState = 1;
          } else {
            [d[1], d[swapIdx]] = [d[swapIdx]!, d[1]!];
            swapState = 0;
          }
          data(d);
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

group('Map Reorder - Reverse Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('reverse $size list', function* (state: BenchState<'size'>) {
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

        const baseData = buildRowData(size, signal);
        data(baseData);

        let reversed = false;

        // Warmup: perform one reverse
        data(data().slice().reverse());

        yield () => {
          if (reversed) {
            data(data().slice().reverse());
            reversed = false;
          } else {
            data(data().slice().reverse());
            reversed = true;
          }
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

group('Map Reorder - Shuffle Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('shuffle $size list', function* (state: BenchState<'size'>) {
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

        const baseData = buildRowData(size, signal);
        data(baseData);

        // Warmup: perform one shuffle
        data(shuffle(data()));

        yield () => {
          data(shuffle(data()));
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

// Compare all reorder operations at same size
group('Map Reorder - Operation Comparison (1000 items)', () => {
  summary(() => {
    barplot(() => {
      bench('swap 2', function* () {
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

        let state = 0;

        // Warmup: perform one swap
        const warmupD = data().slice();
        [warmupD[1], warmupD[998]] = [warmupD[998]!, warmupD[1]!];
        data(warmupD);

        yield () => {
          const d = data().slice();
          [d[1], d[998]] = [d[998]!, d[1]!];
          data(d);
          state = 1 - state;
        };

        resetIdCounter();
      });

      bench('reverse', function* () {
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

        // Warmup: perform one reverse
        data(data().slice().reverse());

        yield () => {
          data(data().slice().reverse());
        };

        resetIdCounter();
      });

      bench('shuffle', function* () {
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

        // Warmup: perform one shuffle
        data(shuffle(data()));

        yield () => {
          data(shuffle(data()));
        };

        resetIdCounter();
      });
    });
  });
});

await runBenchmark();
