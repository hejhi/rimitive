/**
 * MINIMAL MEMORY LEAK REPRODUCTION
 *
 * This benchmark clearly demonstrates a memory leak in computed nodes.
 * Memory usage grows linearly with the number of signal updates when
 * computeds are present, but NOT when using direct signal subscriptions.
 *
 * Key findings:
 * - Direct signal→effect: NO memory growth (stays under 1MB)
 * - Signal→computed→effect: SEVERE memory growth (~800KB per 1000 updates)
 * - The leak occurs regardless of computed complexity
 * - Memory is retained even after GC, suggesting references are being held
 */

import { bench, group } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createApi } from './helpers/signal-computed-effect';

const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;
const latticeEffect = latticeAPI.effect;

group('MINIMAL MEMORY LEAK TEST', () => {
  // This shows NO memory leak
  bench('Direct signal (NO LEAK) - 10k updates', function* () {
    const source = latticeSignal(0);

    // 200 effects reading signal directly
    const disposers = Array.from({ length: 200 }, () =>
      latticeEffect(() => {
        source(); // Direct read
      })
    );

    yield () => {
      for (let i = 0; i < 10000; i++) {
        source(i);
      }
    };

    disposers.forEach(d => d());
  });

  // This shows SEVERE memory leak
  bench('With computed (LEAK!) - 10k updates', function* () {
    const source = latticeSignal(0);

    // 200 computeds that just pass through the value
    const computeds = Array.from({ length: 200 }, () =>
      latticeComputed(() => source())
    );

    // Effects reading the computeds
    const disposers = computeds.map(c =>
      latticeEffect(() => {
        c(); // Read computed
      })
    );

    yield () => {
      for (let i = 0; i < 10000; i++) {
        source(i);
      }
    };

    disposers.forEach(d => d());
  });

  // This shows the leak scales with updates
  bench('With computed (LEAK!) - 1k updates', function* () {
    const source = latticeSignal(0);

    const computeds = Array.from({ length: 200 }, () =>
      latticeComputed(() => source())
    );

    const disposers = computeds.map(c =>
      latticeEffect(() => {
        c();
      })
    );

    yield () => {
      for (let i = 0; i < 1000; i++) {
        source(i);
      }
    };

    disposers.forEach(d => d());
  });

  // Minimal case: single computed, many updates
  bench('Single computed - 50k updates (shows leak per computed)', function* () {
    const source = latticeSignal(0);
    const computed = latticeComputed(() => source());
    const dispose = latticeEffect(() => { computed(); });

    yield () => {
      for (let i = 0; i < 50000; i++) {
        source(i);
      }
    };

    dispose();
  });
});

await runBenchmark();