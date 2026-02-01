/**
 * Map Append - Pure Algorithmic Benchmark
 *
 * Uses counting adapter (O(1) operations) to measure only reconciliation
 * algorithm performance, not adapter implementation details.
 *
 * Reports both timing AND operation counts for complete picture.
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

const APPEND_COUNT = 100;

group('Map Append (Algorithmic) - Fixed Count to Varying Size', () => {
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
        sharedAdapter.reset(); // Clear counts from setup

        // Pre-build append data
        const appendData = buildRowData(APPEND_COUNT, signal);

        // Warmup: run one append/reset cycle
        data(currentData.concat(appendData));
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        sharedAdapter.reset();

        yield () => {
          // Append to existing list
          data(currentData.concat(appendData));
        };

        // Log operation counts for the largest case
        if (existingCount === 10000) {
          console.log(`  [${existingCount}] insertBefore: ${sharedAdapter.counts.insertBefore}, createNode: ${sharedAdapter.counts.createNode}`);
        }

        // Reset for next iteration
        currentData = buildRowData(existingCount, signal);
        data(currentData);
        sharedAdapter.reset();
        resetIdCounter();
      }).args('existing', [0, ...LIST_SCALES]);
    });
  });
});

group('Map Append (Algorithmic) - Operation Counts', () => {
  // Single run to show operation counts clearly
  bench('append 100 to 10000 (show counts)', function* () {
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

    // Setup
    const existing = buildRowData(10000, signal);
    data(existing);
    sharedAdapter.reset();

    const appended = buildRowData(100, signal);

    // Warmup: run one append/reset cycle
    data(existing.concat(appended));
    data(existing);
    sharedAdapter.reset();

    yield () => {
      data(existing.concat(appended));
    };

    // Report counts
    console.log('\n  Operation counts for append 100 to 10000:');
    console.log(`    createNode: ${sharedAdapter.counts.createNode}`);
    console.log(`    insertBefore: ${sharedAdapter.counts.insertBefore}`);
    console.log(`    appendChild: ${sharedAdapter.counts.appendChild}`);
    console.log(`    removeChild: ${sharedAdapter.counts.removeChild}`);

    resetIdCounter();
  });
});

await runBenchmark();
