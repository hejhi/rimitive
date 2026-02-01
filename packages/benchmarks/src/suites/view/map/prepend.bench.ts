/**
 * Map Prepend Scaling Benchmark
 *
 * Tests prepend operation scalability - the "worst case" for many implementations.
 * Key metric: Should ideally be O(k), but naive implementations are O(n).
 *
 * Scaling: Prepend fixed count to lists of varying sizes (100, 1000, 10000)
 *
 * This is a stress test for reconciliation algorithms. A naive diff might:
 * - Re-scan entire list to find differences
 * - Move all existing nodes to make room
 *
 * An optimized algorithm should:
 * - Detect prepend pattern quickly
 * - Insert new nodes without touching existing ones
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

const PREPEND_COUNT = 100;

group('Map Prepend - Fixed Count to Varying Size', () => {
  summary(() => {
    barplot(() => {
      bench(`prepend ${PREPEND_COUNT} to $existing existing`, function* (state: BenchState<'existing'>) {
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

        // Pre-build prepend data (with lower IDs to ensure they're "new")
        resetIdCounter();
        const prependData = buildRowData(PREPEND_COUNT, signal);

        // Warmup: perform one prepend cycle
        data(prependData.concat(currentData));
        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        resetIdCounter();
        const prependData2 = buildRowData(PREPEND_COUNT, signal);

        yield () => {
          // Prepend to existing list
          data(prependData2.concat(currentData));
        };

        // Reset for next iteration
        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
      }).args('existing', [0, ...LIST_SCALES]);
    });
  });
});

// Compare prepend vs append at same scale
group('Map Prepend vs Append - Same Operation', () => {
  summary(() => {
    barplot(() => {
      bench('prepend 100 to $existing', function* (state: BenchState<'existing'>) {
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

        let currentData = buildRowData(existingCount, signal);
        data(currentData);

        resetIdCounter();
        const prependData = buildRowData(100, signal);

        // Warmup: perform one prepend cycle
        data(prependData.concat(currentData));
        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        resetIdCounter();
        const prependData2 = buildRowData(100, signal);

        yield () => {
          data(prependData2.concat(currentData));
        };

        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
      }).args('existing', [1000, 10000]);

      bench('append 100 to $existing', function* (state: BenchState<'existing'>) {
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

        let currentData = buildRowData(existingCount, signal);
        data(currentData);

        const appendData = buildRowData(100, signal);

        // Warmup: perform one append cycle
        data(currentData.concat(appendData));
        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        const appendData2 = buildRowData(100, signal);

        yield () => {
          data(currentData.concat(appendData2));
        };

        resetIdCounter();
        currentData = buildRowData(existingCount, signal);
        data(currentData);
      }).args('existing', [1000, 10000]);
    });
  });
});

await runBenchmark();
