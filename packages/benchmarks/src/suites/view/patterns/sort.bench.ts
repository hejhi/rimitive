/**
 * Sort Pattern Benchmark
 *
 * Tests the common "sort list" operation - reorder all items.
 * This is a real-world pattern that stress-tests reconciliation.
 *
 * Key metric: Should efficiently move existing nodes rather than recreate.
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

group('Pattern - Sort List', () => {
  summary(() => {
    barplot(() => {
      bench('sort $size items by id', function* (state: BenchState<'size'>) {
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

        const rows = buildRowData(size, signal);
        data(rows);

        let ascending = true;

        yield () => {
          const sorted = data().slice().sort((a, b) =>
            ascending ? a.id - b.id : b.id - a.id
          );
          data(sorted);
          ascending = !ascending;
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

// Compare sort vs shuffle (sort has structure, shuffle is random)
group('Pattern - Sort vs Shuffle', () => {
  summary(() => {
    barplot(() => {
      bench('sort 1000 (structured reorder)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        let ascending = true;

        yield () => {
          const sorted = data().slice().sort((a, b) =>
            ascending ? a.id - b.id : b.id - a.id
          );
          data(sorted);
          ascending = !ascending;
        };

        resetIdCounter();
      });

      bench('shuffle 1000 (random reorder)', function* () {
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

        const rows = buildRowData(1000, signal);
        data(rows);

        // Fisher-Yates shuffle
        const shuffle = <T>(arr: T[]): T[] => {
          const result = arr.slice();
          for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j]!, result[i]!];
          }
          return result;
        };

        yield () => {
          data(shuffle(data()));
        };

        resetIdCounter();
      });
    });
  });
});

await runBenchmark();
