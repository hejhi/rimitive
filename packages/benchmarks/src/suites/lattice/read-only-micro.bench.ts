/**
 * Read-Only Microbenchmark (Lattice-only)
 *
 * Purpose: isolate pure read performance without writes, focusing on the
 * hot path of computed.value/peek and single edge registration behavior.
 */

import { describe, bench } from 'vitest';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createEffectFactory } from '@lattice/signals/effect';

const ITERATIONS = 100000;

const { signal, computed } = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
  effect: createEffectFactory,
}, createDefaultContext());

describe('Lattice - read-only micro', () => {
  const s = signal(1);
  const c1 = computed(() => s.value + 1);
  const c2 = computed(() => c1.value + 1);

  // Warm up to establish dependencies and caches
  void s.value; void c1.value; void c2.value;

  bench('read signal + c1 + c2 (no writes)', () => {
    let acc = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      acc += s.value;
      acc += c1.value;
      acc += c2.value;
    }
    // Prevent dead-code elimination
    if (acc === Number.MIN_VALUE) console.log('noop');
  });
});

