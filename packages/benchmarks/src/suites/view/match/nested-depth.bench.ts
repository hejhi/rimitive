/**
 * Match Nested Depth Benchmark
 *
 * Tests nested match (match-in-match) performance.
 * Key metric: Should be O(depth) for disposal, not O(depth²).
 *
 * Scaling: 1, 5, 10, 20 nesting levels
 *
 * This stress-tests:
 * - Scope nesting overhead
 * - Cascading disposal cost
 * - Memory allocation patterns
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  type BenchState,
  type CountingNode,
  type RefSpec,
} from '../deps/counting-harness';

const NEST_DEPTHS: number[] = [1, 5, 10, 20];

group('Match - Nested Depth Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('toggle $depth nested matches', function* (state: BenchState<'depth'>) {
        const depth = state.get('depth');
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        // Outer signal controls all nested matches
        const show = signal(true);

        // Build nested match structure iteratively
        // Start from innermost and wrap outward
        let nested: RefSpec<CountingNode> = el('span')('innermost');
        for (let i = 0; i < depth; i++) {
          const inner = nested;
          nested = match(show, (s: boolean) =>
            s ? el('div')(inner) : null
          );
        }

        const spec = el('div')(nested);

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let showState = true;

        yield () => {
          // Toggle outermost - should dispose/recreate all nested
          showState = !showState;
          show(showState);
        };
      }).args('depth', NEST_DEPTHS);
    });
  });
});

// Compare nested matches vs flat structure
group('Match - Nested vs Flat (same element count)', () => {
  summary(() => {
    barplot(() => {
      // Nested: 10 match levels
      bench('10 nested matches', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const show = signal(true);

        // Build 10 nested matches iteratively
        let nested: RefSpec<CountingNode> = el('span')('leaf');
        for (let i = 0; i < 10; i++) {
          const inner = nested;
          nested = match(show, (s: boolean) =>
            s ? el('div')(inner) : null
          );
        }

        const spec = el('div')(nested);
        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let showState = true;

        yield () => {
          showState = !showState;
          show(showState);
        };
      });

      // Flat: 1 match with 10 elements
      bench('1 match with 10 siblings', function* () {
        const { svc, adapter } = createCountingService();
        const { el, match, signal } = svc;

        const show = signal(true);

        const spec = el('div')(
          match(show, (s: boolean) =>
            s
              ? el('div')(
                  ...Array.from({ length: 10 }, (_, i) => el('span')(`item-${i}`))
                )
              : null
          )
        );

        const root = createCountingRoot();
        const ref = spec.create(svc);
        adapter.appendChild(root, ref.element as CountingNode);

        let showState = true;

        yield () => {
          showState = !showState;
          show(showState);
        };
      });
    });
  });
});

await runBenchmark();
