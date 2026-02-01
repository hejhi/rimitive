/**
 * Map Partial Update Benchmark
 *
 * Tests updating a subset of items (via signal writes, not reconciliation).
 * Key metric: Should be O(k) where k = items updated, regardless of list size.
 *
 * Scaling: Lists of varying sizes (100, 1000, 10000)
 *
 * This differs from reconciliation benchmarks - here we're measuring:
 * - Signal propagation cost
 * - Text node update cost
 * - NOT reconciliation (keys don't change)
 *
 * Patterns tested:
 * - Update every Nth item (sparse updates)
 * - Update first N items (contiguous updates)
 * - Update random items
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

group('Map Update - Every 10th Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('update every 10th in $size list', function* (state: BenchState<'size'>) {
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

        const rows = buildRowData(size, signal);
        data(rows);

        let iteration = 0;

        // Warmup: run one update cycle
        for (let i = 0; i < rows.length; i += 10) {
          const row = rows[i];
          if (row) {
            row.label(`Warmup - ${i}`);
          }
        }

        yield () => {
          // Update every 10th row's label
          for (let i = 0; i < rows.length; i += 10) {
            const row = rows[i];
            if (row) {
              row.label(`Updated ${iteration} - ${i}`);
            }
          }
          iteration++;
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

// Varying update ratios
group('Map Update - Varying Ratio (1000 items)', () => {
  summary(() => {
    barplot(() => {
      bench('update every 100th (1%)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        let iteration = 0;

        // Warmup: run one update cycle
        for (let i = 0; i < rows.length; i += 100) {
          rows[i]?.label(`Warmup`);
        }

        yield () => {
          for (let i = 0; i < rows.length; i += 100) {
            rows[i]?.label(`Updated ${iteration}`);
          }
          iteration++;
        };

        resetIdCounter();
      });

      bench('update every 10th (10%)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        let iteration = 0;

        // Warmup: run one update cycle
        for (let i = 0; i < rows.length; i += 10) {
          rows[i]?.label(`Warmup`);
        }

        yield () => {
          for (let i = 0; i < rows.length; i += 10) {
            rows[i]?.label(`Updated ${iteration}`);
          }
          iteration++;
        };

        resetIdCounter();
      });

      bench('update every 2nd (50%)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        let iteration = 0;

        // Warmup: run one update cycle
        for (let i = 0; i < rows.length; i += 2) {
          rows[i]?.label(`Warmup`);
        }

        yield () => {
          for (let i = 0; i < rows.length; i += 2) {
            rows[i]?.label(`Updated ${iteration}`);
          }
          iteration++;
        };

        resetIdCounter();
      });

      bench('update all (100%)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        let iteration = 0;

        // Warmup: run one update cycle
        for (const row of rows) {
          row.label(`Warmup`);
        }

        yield () => {
          for (const row of rows) {
            row.label(`Updated ${iteration}`);
          }
          iteration++;
        };

        resetIdCounter();
      });
    });
  });
});

await runBenchmark();
