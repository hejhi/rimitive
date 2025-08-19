import { describe, bench } from 'vitest';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

describe('Link Function Overhead Analysis', () => {
  // Set up the Lattice API
  const latticeAPI = createSignalAPI({
    signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
    computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(fn: () => T) => ComputedInterface<T>>,
  }, createDefaultContext());
  
  const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
  const computed = latticeAPI.computed as <T>(fn: () => T) => ComputedInterface<T>;
  
  // Create signals to test linking
  const signals = Array.from({ length: 100 }, (_, i) => 
    signal(i)
  );
  
  // Test direct signal read (baseline)
  bench('baseline: direct _value access', () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      // Direct property access, bypassing getter
      sum += (signals[i % 100] as any)._value;
    }
  });

  // Test signal read without any consumers (no linking)
  bench('signal read: no consumers (untracked)', () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += signals[i % 100]!();
    }
  });

  // Test signal read with 1 consumer (minimal linking)
  bench('signal read: 1 consumer (tracked)', () => {
    const comp = computed(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += signals[i % 100]!();
      }
      return sum;
    });
    
    // Force evaluation
    comp();
  });

  // Test signal read with multiple consumers (more linking overhead)
  bench('signal read: 5 consumers per signal', () => {
    // Create 5 computeds that each read all signals
    const computeds = Array.from({ length: 5 }, () =>
      computed(() => {
        let sum = 0;
        for (let i = 0; i < 200; i++) {
          sum += signals[i % 100]!();
        }
        return sum;
      })
    );
    
    // Force evaluation of all computeds
    let total = 0;
    for (const c of computeds) {
      total += c();
    }
  });

  // Test repeated reads of same signal (cache hit scenario)
  bench('signal read: repeated same signal (cache hits)', () => {
    const sig = signals[0];
    const comp = computed(() => {
      let sum = 0;
      // Read same signal 1000 times
      for (let i = 0; i < 1000; i++) {
        sum += sig!();
      }
      return sum;
    });
    
    comp();
  });

  // Test reads of different signals (cache misses)
  bench('signal read: different signals (cache misses)', () => {
    const comp = computed(() => {
      let sum = 0;
      // Read different signals in sequence
      for (let i = 0; i < 1000; i++) {
        sum += signals[i % 100]!();
      }
      return sum;
    });
    
    comp();
  });

  // Test with pre-existing dependencies (should hit fast path)
  bench('signal read: pre-linked dependencies', () => {
    // First, establish all dependencies
    const comp = computed(() => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += signals[i]!();
      }
      return sum;
    });
    
    // Prime the dependencies
    comp();
    
    // Now measure reads with established links
    comp();
  });

  // Test first-time linking (worst case)
  bench('signal read: first-time linking', () => {
    // Create fresh computed each iteration to force new linking
    const comp = computed(() => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += signals[i]!();
      }
      return sum;
    });
    
    comp();
  });
});