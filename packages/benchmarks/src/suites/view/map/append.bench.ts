/**
 * Map Append Scaling Benchmark
 *
 * Tests append operation scalability.
 * Key metric: Should be O(k) where k = items appended, NOT O(n) where n = existing list size.
 *
 * Scaling: Append fixed count to lists of varying sizes (100, 1000, 10000)
 *
 * A naive implementation might re-scan the entire list to find insertion point.
 * An optimized implementation maintains tail pointer for O(1) append position lookup.
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

const APPEND_COUNT = 100;

// Create service once at module level to reduce variance
const { svc: sharedSvc, adapter: sharedAdapter } = createCountingService();

group('Map Append - Fixed Count to Varying Size', () => {
  summary(() => {
    barplot(() => {
      bench(`append ${APPEND_COUNT} to $existing existing`, function* (state: BenchState<'existing'>) {
        const existingCount = state.get('existing');
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

        // Setup: create existing rows
        let currentData = buildRowData(existingCount, signal);
        data(currentData);

        // Pre-build append data
        const appendData = buildRowData(APPEND_COUNT, signal);

        // Warmup - ensure JIT compilation
        data(currentData.concat(appendData));
        currentData = buildRowData(existingCount, signal);
        data(currentData);

        yield () => {
          // Append to existing list
          data(currentData.concat(appendData));
        };

        // Reset for next iteration
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        resetIdCounter();
      }).args('existing', [0, ...LIST_SCALES]);
    });
  });
});

// Test varying append sizes to same base
group('Map Append - Varying Count to Fixed Size', () => {
  summary(() => {
    barplot(() => {
      bench('append $count to 1000', function* (state: BenchState<'count'>) {
        const appendCount = state.get('count');
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

        // Setup: create base list
        let baseData = buildRowData(1000, signal);
        data(baseData);

        // Pre-build append data
        const appendData = buildRowData(appendCount, signal);

        // Warmup
        data(baseData.concat(appendData));
        baseData = buildRowData(1000, signal);
        data(baseData);

        yield () => {
          data(baseData.concat(appendData));
        };

        // Reset
        baseData = buildRowData(1000, signal);
        data(baseData);
        resetIdCounter();
      }).args('count', [10, 100, 1000]);
    });
  });
});

await runBenchmark();
