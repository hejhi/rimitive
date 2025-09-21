/**
 * MINIMAL MEMORY LEAK REPRODUCTION
 *
 * This benchmark demonstrates the ACTUAL root cause of the memory leak:
 * Dependencies accumulate without being cleaned up when the dependency
 * graph changes.
 *
 * The issue is NOT that we create new objects on every update (we don't),
 * but that we fail to clean up OLD dependencies when they change.
 *
 * Key findings:
 * - Static dependencies (same signal): NO LEAK (dependencies are reused)
 * - Changing dependencies: SEVERE LEAK (old dependencies never cleaned)
 * - The leak is in accumulating stale Dependency objects
 */

import { bench, group } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createApi } from './helpers/signal-computed-effect';

const latticeAPI = createApi();
const latticeSignal = latticeAPI.signal;
const latticeComputed = latticeAPI.computed;
const latticeEffect = latticeAPI.effect;

group('MEMORY LEAK ROOT CAUSE - Dependency Accumulation', () => {
  // This shows NO memory leak - dependencies don't change
  bench('Static dependencies (NO LEAK) - 10k updates', function* () {
    const source = latticeSignal(0);

    // 200 computeds with STATIC dependencies
    const computeds = Array.from({ length: 200 }, () =>
      latticeComputed(() => source())
    );

    const disposers = computeds.map(c =>
      latticeEffect(() => { c(); })
    );

    yield () => {
      for (let i = 0; i < 10000; i++) {
        source(i);
      }
    };

    disposers.forEach(d => d());
  });

  // This SHOULD show memory leak - dependencies change
  bench('Switching dependencies (LEAK!) - 1k switches', function* () {
    const signal1 = latticeSignal(0);
    const signal2 = latticeSignal(0);
    let useFirst = true;

    // 200 computeds that SWITCH dependencies
    const computeds = Array.from({ length: 200 }, () =>
      latticeComputed(() => useFirst ? signal1() : signal2())
    );

    const disposers = computeds.map(c =>
      latticeEffect(() => { c(); })
    );

    yield () => {
      for (let i = 0; i < 1000; i++) {
        useFirst = !useFirst;
        signal1(i);
        signal2(i);
      }
    };

    disposers.forEach(d => d());
  });

  // Even more dramatic: many signals to switch between
  bench('Many dependency switches (SEVERE LEAK)', function* () {
    const signals = Array.from({ length: 10 }, (_, i) => latticeSignal(i));
    let currentIndex = 0;

    // 200 computeds that cycle through different dependencies
    const computeds = Array.from({ length: 200 }, () =>
      latticeComputed(() => signals[currentIndex]!())
    );

    const disposers = computeds.map(c =>
      latticeEffect(() => { c(); })
    );

    yield () => {
      // Switch dependencies 100 times
      for (let i = 0; i < 100; i++) {
        currentIndex = (currentIndex + 1) % signals.length;
        // Update all signals to trigger recomputation
        signals.forEach((s, idx) => s(idx + i));
      }
    };

    disposers.forEach(d => d());
  });

  // Minimal reproduction: single computed switching deps
  bench('Single computed switching deps - 10k switches', function* () {
    const signal1 = latticeSignal(0);
    const signal2 = latticeSignal(0);
    let useFirst = true;

    const computed = latticeComputed(() => useFirst ? signal1() : signal2());
    const dispose = latticeEffect(() => { computed(); });

    yield () => {
      for (let i = 0; i < 10000; i++) {
        useFirst = !useFirst;
        signal1(i);
        signal2(i);
      }
    };

    dispose();
  });

  // Control: Direct signal subscriptions with switching
  bench('Direct effects switching (NO LEAK - control)', function* () {
    const signal1 = latticeSignal(0);
    const signal2 = latticeSignal(0);
    let useFirst = true;

    // Direct effects that switch which signal they read
    const disposers = Array.from({ length: 200 }, () =>
      latticeEffect(() => {
        if (useFirst) signal1(); else signal2();
      })
    );

    yield () => {
      for (let i = 0; i < 1000; i++) {
        useFirst = !useFirst;
        signal1(i);
        signal2(i);
      }
    };

    disposers.forEach(d => d());
  });
});

await runBenchmark();