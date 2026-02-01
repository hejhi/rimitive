/**
 * Pagination Pattern Benchmark
 *
 * Tests the common "replace page of data" operation.
 * User navigates between pages - completely different items.
 *
 * Key metric: Since IDs change completely, reconciler should efficiently
 * dispose old and create new rather than trying to diff.
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  buildRowData,
  resetIdCounter,
  type BenchState,
  type RowData,
  type Reactive,
  type CountingNode,
} from '../deps/counting-harness';

const PAGE_SIZES: number[] = [20, 50, 100];

group('Pattern - Pagination', () => {
  summary(() => {
    barplot(() => {
      bench('replace page of $pageSize items', function* (state: BenchState<'pageSize'>) {
        const pageSize = state.get('pageSize');
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

        // Pre-build several "pages" of data
        resetIdCounter();
        const page1 = buildRowData(pageSize, signal);
        const page2 = buildRowData(pageSize, signal);
        const page3 = buildRowData(pageSize, signal);
        const pages = [page1, page2, page3];

        let currentPage = 0;
        data(pages[0]!);

        yield () => {
          // Navigate to next page (completely different IDs)
          currentPage = (currentPage + 1) % pages.length;
          data(pages[currentPage]!);
        };

        resetIdCounter();
      }).args('pageSize', PAGE_SIZES);
    });
  });
});

// Compare pagination (different IDs) vs update-in-place (same IDs)
group('Pattern - Pagination vs Update-in-Place', () => {
  summary(() => {
    barplot(() => {
      bench('pagination: replace 50 items (different IDs)', function* () {
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

        resetIdCounter();
        const page1 = buildRowData(50, signal);
        const page2 = buildRowData(50, signal);

        let usePage1 = true;
        data(page1);

        yield () => {
          data(usePage1 ? page2 : page1);
          usePage1 = !usePage1;
        };

        resetIdCounter();
      });

      bench('update-in-place: update 50 items (same IDs)', function* () {
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

        const rows = buildRowData(50, signal);
        data(rows);

        let iteration = 0;

        yield () => {
          // Update labels in place (same IDs, just signal updates)
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
