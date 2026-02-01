/**
 * Counting harness for pure algorithmic benchmarking
 *
 * Uses the counting adapter for O(1) adapter operations,
 * measuring only the reconciliation algorithm performance.
 */

import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import {
  createCountingAdapter,
  createCountingRoot,
  type CountingTreeConfig,
  type CountingNode,
  type CountingAdapter,
} from './counting-adapter';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import type { Reactive } from '@rimitive/view/types';

// ============================================================================
// Service Creation
// ============================================================================

export function createCountingService() {
  const adapter = createCountingAdapter();
  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule<CountingTreeConfig>(adapter),
    createMapModule<CountingTreeConfig>(adapter),
    createMatchModule<CountingTreeConfig>(adapter)
  );
  return { svc, adapter };
}

export type CountingService = ReturnType<typeof createCountingService>['svc'];

export { createCountingRoot, type CountingNode, type CountingAdapter, type Reactive };

// Re-export RefSpec for type annotations
export type { RefSpec } from '@rimitive/view/types';

// ============================================================================
// Row Data Generation (mirrors js-framework-benchmark)
// ============================================================================

let idCounter = 1;

const adjectives = [
  'pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome',
  'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful',
];

const colours = [
  'red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'orange',
];

const nouns = [
  'table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie',
];

function random(max: number): number {
  return Math.round(Math.random() * 1000) % max;
}

export type SignalFn<T> = Reactive<T> & ((value: T) => void);

export type RowData = {
  id: number;
  label: SignalFn<string>;
};

/**
 * Build row data for benchmarks
 * @param count Number of rows to create
 * @param signal Signal factory function
 */
export function buildRowData<T extends (v: string) => SignalFn<string>>(
  count: number,
  signal: T
): RowData[] {
  const result: RowData[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = {
      id: idCounter++,
      label: signal(
        `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${nouns[random(nouns.length)]}`
      ),
    };
  }
  return result;
}

/**
 * Reset the ID counter (call between benchmark iterations if needed)
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * Get current ID counter value
 */
export function getIdCounter(): number {
  return idCounter;
}

// ============================================================================
// Scaling Configurations
// ============================================================================

/**
 * Standard scaling for list operations
 * Tests algorithmic complexity across 3 orders of magnitude
 */
export const LIST_SCALES: number[] = [100, 1000, 10000];

/**
 * Extended scaling including small lists
 * Useful for operations that might have high per-item overhead
 */
export const LIST_SCALES_EXTENDED: number[] = [10, 100, 1000, 10000];

/**
 * Depth scaling for nested structures
 */
export const DEPTH_SCALES: number[] = [5, 10, 20, 50];

/**
 * Width scaling for sibling count
 */
export const WIDTH_SCALES: number[] = [10, 50, 100, 500];

// ============================================================================
// Benchmark State Type
// ============================================================================

export type BenchState<T extends string = string> = {
  get(name: T): number;
  get(name: string): unknown;
};
