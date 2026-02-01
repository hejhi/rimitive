/**
 * Map Remove Scaling Benchmark
 *
 * Tests single item removal scalability.
 * Key metric: Should be O(1) for removal itself, though finding the item may vary.
 *
 * Scaling: Remove from lists of varying sizes (100, 1000, 10000)
 *
 * Tests removal from different positions:
 * - Start (index 0)
 * - Middle (index n/2)
 * - End (index n-1)
 *
 * Position matters for:
 * - DOM operations (removing from start may trigger more reflows)
 * - Reconciliation algorithm (linked list traversal)
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

group('Map Remove - Single Item Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('remove middle from $size', function* (state: BenchState<'size'>) {
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
        let currentData = buildRowData(size, signal);
        data(currentData);

        // Warmup: perform one removal cycle
        const warmupIdx = Math.floor(currentData.length / 2);
        currentData = [
          ...currentData.slice(0, warmupIdx),
          ...currentData.slice(warmupIdx + 1),
        ];
        data(currentData);
        resetIdCounter();
        currentData = buildRowData(size, signal);
        data(currentData);

        yield () => {
          // Remove from middle
          const midIdx = Math.floor(currentData.length / 2);
          currentData = [
            ...currentData.slice(0, midIdx),
            ...currentData.slice(midIdx + 1),
          ];
          data(currentData);

          // Replenish periodically to maintain size
          if (currentData.length < size * 0.9) {
            resetIdCounter();
            currentData = buildRowData(size, signal);
            data(currentData);
          }
        };

        resetIdCounter();
      }).args('size', LIST_SCALES);
    });
  });
});

// Compare removal positions
group('Map Remove - Position Comparison', () => {
  summary(() => {
    barplot(() => {
      bench('remove from start ($size items)', function* (state: BenchState<'size'>) {
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

        let currentData = buildRowData(size, signal);
        data(currentData);

        // Warmup: perform one removal cycle
        currentData = currentData.slice(1);
        data(currentData);
        resetIdCounter();
        currentData = buildRowData(size, signal);
        data(currentData);

        yield () => {
          // Remove first item
          currentData = currentData.slice(1);
          data(currentData);

          if (currentData.length < size * 0.9) {
            resetIdCounter();
            currentData = buildRowData(size, signal);
            data(currentData);
          }
        };

        resetIdCounter();
      }).args('size', [1000]);

      bench('remove from middle ($size items)', function* (state: BenchState<'size'>) {
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

        let currentData = buildRowData(size, signal);
        data(currentData);

        // Warmup: perform one removal cycle
        const warmupIdx = Math.floor(currentData.length / 2);
        currentData = [...currentData.slice(0, warmupIdx), ...currentData.slice(warmupIdx + 1)];
        data(currentData);
        resetIdCounter();
        currentData = buildRowData(size, signal);
        data(currentData);

        yield () => {
          const midIdx = Math.floor(currentData.length / 2);
          currentData = [...currentData.slice(0, midIdx), ...currentData.slice(midIdx + 1)];
          data(currentData);

          if (currentData.length < size * 0.9) {
            resetIdCounter();
            currentData = buildRowData(size, signal);
            data(currentData);
          }
        };

        resetIdCounter();
      }).args('size', [1000]);

      bench('remove from end ($size items)', function* (state: BenchState<'size'>) {
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

        let currentData = buildRowData(size, signal);
        data(currentData);

        // Warmup: perform one removal cycle
        currentData = currentData.slice(0, -1);
        data(currentData);
        resetIdCounter();
        currentData = buildRowData(size, signal);
        data(currentData);

        yield () => {
          // Remove last item
          currentData = currentData.slice(0, -1);
          data(currentData);

          if (currentData.length < size * 0.9) {
            resetIdCounter();
            currentData = buildRowData(size, signal);
            data(currentData);
          }
        };

        resetIdCounter();
      }).args('size', [1000]);
    });
  });
});

await runBenchmark();
