/**
 * Element Creation Depth Scaling Benchmark
 *
 * Tests nested element creation scalability.
 * Key metric: Should be O(n) where n = depth.
 *
 * Scaling: 5, 10, 20, 50 levels deep
 *
 * This measures the cost of:
 * - Creating nested element specs
 * - Building parent-child relationships
 * - Scope nesting overhead
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  DEPTH_SCALES,
  type BenchState,
  type CountingNode,
} from '../deps/counting-harness';

group('Element Create - Depth Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('create $depth levels deep', function* (state: BenchState<'depth'>) {
        const depth = state.get('depth');
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        // Build nested spec programmatically using iteration (avoids recursive type issues)
        const buildNestedSpec = (levels: number) => {
          let current = el('span')('leaf');
          for (let i = 0; i < levels; i++) {
            current = el('div')(current);
          }
          return current;
        };

        const root = createCountingRoot();

        yield () => {
          const spec = buildNestedSpec(depth);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      }).args('depth', DEPTH_SCALES);
    });
  });
});

// Compare depth vs width at same total node count
group('Element Create - Depth vs Width (same node count)', () => {
  summary(() => {
    barplot(() => {
      // Deep: 20 levels, 1 node per level = 20 nodes
      bench('20 deep x 1 wide', function* () {
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        const buildDeep = (levels: number) => {
          let current = el('span')('leaf');
          for (let i = 0; i < levels; i++) {
            current = el('div')(current);
          }
          return current;
        };

        const root = createCountingRoot();

        yield () => {
          const spec = buildDeep(20);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      });

      // Wide: 1 level, 20 children = 21 nodes
      bench('1 deep x 20 wide', function* () {
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        const root = createCountingRoot();

        yield () => {
          const children = Array.from({ length: 20 }, (_, i) =>
            el('span')(`child-${i}`)
          );
          const spec = el('div')(...children);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      });

      // Balanced: 4 levels, ~5 children each ≈ 156 nodes (5^3 + 5^2 + 5 + 1)
      bench('4 deep x 5 wide (balanced)', function* () {
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        // Build a balanced tree iteratively by levels
        const buildBalanced = (depth: number, width: number) => {
          // Start with leaves
          let currentLevel = Array.from({ length: Math.pow(width, depth) }, () =>
            el('span')('leaf')
          );

          // Build up from leaves to root
          for (let level = depth; level > 0; level--) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += width) {
              const children = currentLevel.slice(i, i + width);
              nextLevel.push(el('div')(...children));
            }
            currentLevel = nextLevel;
          }

          return currentLevel[0]!;
        };

        const root = createCountingRoot();

        yield () => {
          const spec = buildBalanced(4, 5);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      });
    });
  });
});

await runBenchmark();
