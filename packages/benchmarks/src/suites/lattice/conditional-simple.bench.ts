/**
 * Conditional Dependencies Scaling Benchmark
 *
 * Tests dynamic dependency tracking and branch pruning with varying complexity.
 * Key metric: Inactive branches should NOT trigger recomputation.
 * Validates push-pull hybrid optimization.
 *
 * Scaling: Tests conditional patterns with increasing branch counts
 * - 2 branches: Simple conditional selection
 * - 4 branches: Medium complexity branching
 * - 8 branches: Complex multi-way branching
 */

import { bench, group, summary, barplot } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';
import { createSvc } from './helpers/signal-computed';

const ITERATIONS = 50000;
const latticeSvc = createSvc();
const { signal: latticeSignal, computed: latticeComputed } = latticeSvc;

type BenchState = {
  get(name: 'branches'): number;
  get(name: string): unknown;
};

group('Conditional Dependencies - Branch Pruning', () => {
  summary(() => {
    barplot(() => {
      bench('Lattice - $branches branches', function* (state: BenchState) {
        const branchCount = state.get('branches');
        const condition = latticeSignal(0);

        // Create multiple branches with expensive computations
        const branches = Array.from({ length: branchCount }, (_, i) =>
          latticeSignal(i)
        );

        // Expensive computations for each branch
        const computedBranches = branches.map((branch) =>
          latticeComputed(() => {
            const val = branch();
            // Expensive computation that should be skipped for inactive branches
            let result = val;
            for (let j = 0; j < 100; j++) {
              result = (result * 31 + j) % 1000007;
            }
            return result;
          })
        );

        // Conditional that selects active branch
        const result = latticeComputed(() => {
          const idx = condition() % branchCount;
          return computedBranches[idx]!();
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            // Change active branch periodically
            if (i % 100 === 0) {
              condition((i / 100) % branchCount);
            }
            // Update ALL branches (but only active should recompute)
            branches.forEach((b, idx) => b(i * (idx + 1)));
            void result();
          }
        };
      }).args('branches', [2, 4, 8]);

      bench('Preact - $branches branches', function* (state: BenchState) {
        const branchCount = state.get('branches');
        const condition = preactSignal(0);

        const branches = Array.from({ length: branchCount }, (_, i) =>
          preactSignal(i)
        );

        const computedBranches = branches.map((branch) =>
          preactComputed(() => {
            const val = branch.value;
            let result = val;
            for (let j = 0; j < 100; j++) {
              result = (result * 31 + j) % 1000007;
            }
            return result;
          })
        );

        const result = preactComputed(() => {
          const idx = condition.value % branchCount;
          return computedBranches[idx]!.value;
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            if (i % 100 === 0) {
              condition.value = (i / 100) % branchCount;
            }
            branches.forEach((b, idx) => (b.value = i * (idx + 1)));
            void result.value;
          }
        };
      }).args('branches', [2, 4, 8]);

      bench('Alien - $branches branches', function* (state: BenchState) {
        const branchCount = state.get('branches');
        const condition = alienSignal(0);

        const branches = Array.from({ length: branchCount }, (_, i) =>
          alienSignal(i)
        );

        const computedBranches = branches.map((branch) =>
          alienComputed(() => {
            const val = branch();
            let result = val;
            for (let j = 0; j < 100; j++) {
              result = (result * 31 + j) % 1000007;
            }
            return result;
          })
        );

        const result = alienComputed(() => {
          const idx = condition() % branchCount;
          return computedBranches[idx]!();
        });

        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            if (i % 100 === 0) {
              condition((i / 100) % branchCount);
            }
            branches.forEach((b, idx) => b(i * (idx + 1)));
            void result();
          }
        };
      }).args('branches', [2, 4, 8]);
    });
  });
});

// Run benchmarks with unified output handling
await runBenchmark();
