/**
 * Map Creation Scaling Benchmark
 *
 * Tests list creation scalability with counting adapter for O(1) adapter ops.
 * Key metric: Should be O(n) - linear with item count.
 *
 * Scaling: 100, 1000, 10000 items
 *
 * This measures the cost of:
 * - Creating row elements
 * - Setting up reactive bindings
 * - Building the reconciliation data structure
 *
 * Note: Uses counting adapter to isolate algorithm performance from adapter overhead.
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

group('Map Create - Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('create $items items', function* (state: BenchState<'items'>) {
        const itemCount = state.get('items');
        const { el, map, signal } = sharedSvc;

        const data = signal<RowData[]>([]);

        // Build the app structure (static, outside timing)
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

        // Warmup: run one create/clear cycle
        data(buildRowData(itemCount, signal));
        data([]);
        resetIdCounter();

        yield () => {
          // Timed: create rows (includes data building + reconciliation)
          data(buildRowData(itemCount, signal));
        };

        // Reset for next iteration
        data([]);
        resetIdCounter();
      }).args('items', [...LIST_SCALES]);
    });
  });
});

// Separate group for "from empty" vs "replace" comparison
group('Map Create - Replace vs Fresh', () => {
  summary(() => {
    barplot(() => {
      // Fresh creation (list was empty)
      bench('fresh $items items', function* (state: BenchState<'items'>) {
        const itemCount = state.get('items');
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

        // Warmup: run one create/clear cycle
        data(buildRowData(itemCount, signal));
        data([]);
        resetIdCounter();

        yield () => {
          // Create fresh data and populate
          data(buildRowData(itemCount, signal));
        };

        data([]);
        resetIdCounter();
      }).args('items', [1000]);

      // Replace existing (list had same number of different items)
      bench('replace $items items', function* (state: BenchState<'items'>) {
        const itemCount = state.get('items');
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

        // Setup: populate with initial data
        data(buildRowData(itemCount, signal));

        // Warmup: run one replace cycle
        data(buildRowData(itemCount, signal));

        yield () => {
          // Replace with completely new data (all different IDs)
          data(buildRowData(itemCount, signal));
        };

        resetIdCounter();
      }).args('items', [1000]);
    });
  });
});

await runBenchmark();
