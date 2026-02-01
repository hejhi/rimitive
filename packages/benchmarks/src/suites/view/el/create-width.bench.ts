/**
 * Element Creation Width Scaling Benchmark
 *
 * Tests wide sibling creation scalability.
 * Key metric: Should be O(n) where n = sibling count.
 *
 * Scaling: 10, 50, 100, 500 siblings
 *
 * This measures the cost of:
 * - Creating many sibling elements
 * - Child array processing
 * - Fragment handling for multiple children
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../../utils/benchmark-runner';
import {
  createCountingService,
  createCountingRoot,
  WIDTH_SCALES,
  type BenchState,
  type CountingNode,
} from '../deps/counting-harness';

group('Element Create - Width Scaling', () => {
  summary(() => {
    barplot(() => {
      bench('create 1 parent with $width children', function* (state: BenchState<'width'>) {
        const width = state.get('width');
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        const root = createCountingRoot();

        yield () => {
          const children = Array.from({ length: width }, (_, i) =>
            el('span')(`child-${i}`)
          );
          const spec = el('div')(...children);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      }).args('width', WIDTH_SCALES);
    });
  });
});

// Test with reactive children (signals in text)
group('Element Create - Width with Reactive Content', () => {
  summary(() => {
    barplot(() => {
      bench('$width static children', function* (state: BenchState<'width'>) {
        const width = state.get('width');
        const { svc, adapter } = createCountingService();
        const { el } = svc;

        const root = createCountingRoot();

        yield () => {
          const children = Array.from({ length: width }, (_, i) =>
            el('span')(`static-${i}`)
          );
          const spec = el('div')(...children);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      }).args('width', [100]);

      bench('$width reactive children', function* (state: BenchState<'width'>) {
        const width = state.get('width');
        const { svc, adapter } = createCountingService();
        const { el, signal } = svc;

        const root = createCountingRoot();

        yield () => {
          const children = Array.from({ length: width }, (_, i) => {
            const text = signal(`reactive-${i}`);
            return el('span')(text);
          });
          const spec = el('div')(...children);
          const ref = spec.create(svc);
          adapter.appendChild(root, ref.element as CountingNode);
        };
      }).args('width', [100]);
    });
  });
});

await runBenchmark();
