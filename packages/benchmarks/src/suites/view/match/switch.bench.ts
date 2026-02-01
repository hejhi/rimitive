/**
 * Match Switch Benchmark
 *
 * Tests branch switching performance.
 * Key metric: Should be O(old) + O(new) - dispose old, create new.
 *
 * This measures:
 * - Branch disposal cost
 * - New branch creation cost
 * - Scope cleanup overhead
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  type CountingNode,
} from '../deps/counting-harness';

group('Match - Branch Switching', () => {
  summary(() => {
    barplot(() => {
      // Simple switch: single element branches
      bench('switch simple branches', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const condition = signal(true);

        const spec = el('div')(
          match(condition, (show: boolean) =>
            show ? el('span')('shown') : el('span')('hidden')
          )
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          condition(state);
        };
      });

      // Complex switch: branches with multiple children
      bench('switch complex branches (10 children each)', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const condition = signal(true);

        const spec = el('div')(
          match(condition, (show: boolean) => {
            const children = Array.from({ length: 10 }, (_, i) =>
              el('span')(`${show ? 'shown' : 'hidden'}-${i}`)
            );
            return el('div')(...children);
          })
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          condition(state);
        };
      });

      // Switch to null (hide)
      bench('switch to null', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const show = signal(true);

        const spec = el('div')(
          match(show, (s: boolean) =>
            s ? el('span')('content') : null
          )
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          show(state);
        };
      });
    });
  });
});

// Test switch with effects (scope disposal)
group('Match - Switch with Effects', () => {
  summary(() => {
    barplot(() => {
      bench('switch branch without effects', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const condition = signal(true);

        const spec = el('div')(
          match(condition, (show: boolean) =>
            el('div')(show ? 'A' : 'B')
          )
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          condition(state);
        };
      });

      bench('switch branch with 1 effect', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal, effect } = svc;

        const condition = signal(true);

        const spec = el('div')(
          match(condition, (show: boolean) => {
            // Effect created in branch scope
            effect(() => {
              // Read the condition to create dependency
              void show;
            });
            return el('div')(show ? 'A' : 'B');
          })
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          condition(state);
        };
      });

      bench('switch branch with 5 effects', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal, effect } = svc;

        const condition = signal(true);

        const spec = el('div')(
          match(condition, (show: boolean) => {
            // Multiple effects in branch scope
            for (let i = 0; i < 5; i++) {
              effect(() => {
                void show;
              });
            }
            return el('div')(show ? 'A' : 'B');
          })
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let state = true;

        yield () => {
          state = !state;
          condition(state);
        };
      });
    });
  });
});

await runBenchmark();
