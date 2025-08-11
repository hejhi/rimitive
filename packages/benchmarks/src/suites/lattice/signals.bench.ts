/**
 * Comprehensive Signals Library Comparison Benchmark
 *
 * Compares performance between:
 * 1. Preact signals (baseline)
 * 2. Lattice signals (current implementation)
 * 3. Alien signals (Vue 3 inspired push-pull algorithm)
 */

import { run, bench, group, boxplot } from 'mitata';

// Type for mitata benchmark state
interface BenchState {
  get(name: string): any;
}
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createBatchFactory } from '@lattice/signals/batch';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
} from 'alien-signals';

// Removed fixed iterations - now parameterized

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;
const latticeBatch = latticeAPI.batch as <T>(fn: () => T) => T;

boxplot(() => {
  group('Single Signal Updates', () => {
    bench('Preact - single signal operation', function* () {
      const count = preactSignal(0);
      
      // Warm up
      count.value = 1;
      void count.value;
      
      let counter = 0;
      yield () => {
        count.value = counter++;
        void count.value; // Read
      };
    });

    bench('Lattice - single signal operation', function* () {
      const count = latticeSignal(0);
      
      // Warm up
      count.value = 1;
      void count.value;
      
      let counter = 0;
      yield () => {
        count.value = counter++;
        void count.value; // Read
      };
    });

    bench('Alien - single signal operation', function* () {
      const count = alienSignal(0);
      
      // Warm up
      count(1);
      void count();
      
      let counter = 0;
      yield () => {
        count(counter++);
        void count(); // Read
      };
    });
  });
});

boxplot(() => {
  group('Computed Chain', () => {
    bench('Preact - chain length: $length', function* (state: BenchState) {
      const length = state.get('length');
      const a = preactSignal(0);
      let last = a;
      
      // Build chain of specified length
      for (let i = 0; i < length; i++) {
        const prev = last;
        last = preactComputed(() => prev.value * 2);
      }
      
      yield () => {
        a.value++;
        void last.value; // Force evaluation
      };
    })
    .args('length', [1, 3, 5, 10]);

    bench('Lattice - chain length: $length', function* (state: BenchState) {
      const length = state.get('length');
      const a = latticeSignal(0);
      let last: { value: number } = a;
      
      // Build chain of specified length
      for (let i = 0; i < length; i++) {
        const prev = last;
        last = latticeComputed(() => prev.value * 2);
      }
      
      yield () => {
        a.value++;
        void last.value; // Force evaluation
      };
    })
    .args('length', [1, 3, 5, 10]);

    bench('Alien - chain length: $length', function* (state: BenchState) {
      const length = state.get('length');
      const a = alienSignal(0);
      let last = a;
      
      // Build chain of specified length
      for (let i = 0; i < length; i++) {
        const prev = last;
        last = alienComputed(() => prev() * 2);
      }
      
      yield () => {
        a(a() + 1);
        void last(); // Force evaluation
      };
    })
    .args('length', [1, 3, 5, 10]);
  });
});

boxplot(() => {
  group('Deep Computed Tree', () => {
    bench('Preact - deep tree (single propagation)', function* () {
      const root = preactSignal(0);
      const a1 = preactComputed(() => root.value * 2);
      const a2 = preactComputed(() => root.value * 3);
      const b1 = preactComputed(() => a1.value + a2.value);
      const b2 = preactComputed(() => a1.value - a2.value);
      const c1 = preactComputed(() => b1.value * b2.value);
      const c2 = preactComputed(() => b1.value / (b2.value || 1));
      const result = preactComputed(() => c1.value + c2.value);
      
      // Warm up the graph
      root.value = 1;
      void result.value;
      
      let counter = 1;
      yield () => {
        root.value = ++counter;
        void result.value;
      };
    });

    bench('Lattice - deep tree (single propagation)', function* () {
      const root = latticeSignal(0);
      const a1 = latticeComputed(() => root.value * 2);
      const a2 = latticeComputed(() => root.value * 3);
      const b1 = latticeComputed(() => a1.value + a2.value);
      const b2 = latticeComputed(() => a1.value - a2.value);
      const c1 = latticeComputed(() => b1.value * b2.value);
      const c2 = latticeComputed(() => b1.value / (b2.value || 1));
      const result = latticeComputed(() => c1.value + c2.value);
      
      // Warm up the graph
      root.value = 1;
      void result.value;
      
      let counter = 1;
      yield () => {
        root.value = ++counter;
        void result.value;
      };
    });

    bench('Alien - deep tree (single propagation)', function* () {
      const root = alienSignal(0);
      const a1 = alienComputed(() => root() * 2);
      const a2 = alienComputed(() => root() * 3);
      const b1 = alienComputed(() => a1() + a2());
      const b2 = alienComputed(() => a1() - a2());
      const c1 = alienComputed(() => b1() * b2());
      const c2 = alienComputed(() => b1() / (b2() || 1));
      const result = alienComputed(() => c1() + c2());
      
      // Warm up the graph
      root(1);
      void result();
      
      let counter = 1;
      yield () => {
        root(++counter);
        void result();
      };
    });
  });
});

boxplot(() => {
  group('Diamond Pattern', () => {
    bench('Preact - diamond (single propagation)', function* () {
      const source = preactSignal(0);
      const left = preactComputed(() => source.value * 2);
      const right = preactComputed(() => source.value * 3);
      const bottom = preactComputed(() => left.value + right.value);
      
      // Warm up the graph
      source.value = 1;
      void bottom.value;
      
      let counter = 1;
      yield () => {
        source.value = ++counter;
        void bottom.value;
      };
    });

    bench('Lattice - diamond (single propagation)', function* () {
      const source = latticeSignal(0);
      const left = latticeComputed(() => source.value * 2);
      const right = latticeComputed(() => source.value * 3);
      const bottom = latticeComputed(() => left.value + right.value);
      
      // Warm up the graph
      source.value = 1;
      void bottom.value;
      
      let counter = 1;
      yield () => {
        source.value = ++counter;
        void bottom.value;
      };
    });

    bench('Alien - diamond (single propagation)', function* () {
      const source = alienSignal(0);
      const left = alienComputed(() => source() * 2);
      const right = alienComputed(() => source() * 3);
      const bottom = alienComputed(() => left() + right());
      
      // Warm up the graph
      source(1);
      void bottom();
      
      let counter = 1;
      yield () => {
        source(++counter);
        void bottom();
      };
    });
  });
});

boxplot(() => {
  group('Batch Updates', () => {
    bench('Preact - single batch update', function* () {
      const s1 = preactSignal(0);
      const s2 = preactSignal(0);
      const s3 = preactSignal(0);
      const sum = preactComputed(() => s1.value + s2.value + s3.value);
      
      // Warm up
      s1.value = 1;
      void sum.value;
      
      let counter = 0;
      yield () => {
        preactBatch(() => {
          s1.value = counter;
          s2.value = counter * 2;
          s3.value = counter * 3;
        });
        void sum.value;
        counter++;
      };
    });

    bench('Lattice - single batch update', function* () {
      const s1 = latticeSignal(0);
      const s2 = latticeSignal(0);
      const s3 = latticeSignal(0);
      const sum = latticeComputed(() => s1.value + s2.value + s3.value);
      
      // Warm up
      s1.value = 1;
      void sum.value;
      
      let counter = 0;
      yield () => {
        latticeBatch(() => {
          s1.value = counter;
          s2.value = counter * 2;
          s3.value = counter * 3;
        });
        void sum.value;
        counter++;
      };
    });

    bench('Alien - single batch update', function* () {
      const s1 = alienSignal(0);
      const s2 = alienSignal(0);
      const s3 = alienSignal(0);
      const sum = alienComputed(() => s1() + s2() + s3());
      
      // Warm up
      s1(1);
      void sum();
      
      let counter = 0;
      yield () => {
        alienStartBatch();
        s1(counter);
        s2(counter * 2);
        s3(counter * 3);
        alienEndBatch();
        void sum();
        counter++;
      };
    });
  });
});

boxplot(() => {
  group('Large Dependency Graph', () => {
    bench('Preact - large graph: $graphSize nodes (single update)', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const signals = Array.from({ length: graphSize }, (_, i) => preactSignal(i));
      const computeds = signals.map((s, i) =>
        preactComputed(() => {
          let sum = s.value;
          // Each computed depends on up to 3 neighbors
          if (i > 0) sum += signals[i - 1]!.value;
          if (i < signals.length - 1) sum += signals[i + 1]!.value;
          if (i > 1) sum += signals[i - 2]!.value;
          return sum;
        })
      );
      
      // Warm up the graph
      signals[0]!.value = 1;
      void computeds[0]!.value;
      if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
      void computeds[computeds.length - 1]!.value;
      
      let counter = 0;
      let updateIndex = 0;
      yield () => {
        // Update one signal and measure propagation
        updateIndex = counter % signals.length;
        signals[updateIndex]!.value = ++counter;
        // Sample a few computeds to force evaluation
        void computeds[0]!.value;
        if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
        void computeds[computeds.length - 1]!.value;
      };
    })
    .args('graphSize', [5, 10, 20, 50]);

    bench('Lattice - large graph: $graphSize nodes (single update)', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const signals = Array.from({ length: graphSize }, (_, i) => latticeSignal(i));
      const computeds = signals.map((s, i) =>
        latticeComputed(() => {
          let sum = s.value;
          // Each computed depends on up to 3 neighbors
          if (i > 0) sum += signals[i - 1]!.value;
          if (i < signals.length - 1) sum += signals[i + 1]!.value;
          if (i > 1) sum += signals[i - 2]!.value;
          return sum;
        })
      );
      
      // Warm up the graph
      signals[0]!.value = 1;
      void computeds[0]!.value;
      if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
      void computeds[computeds.length - 1]!.value;
      
      let counter = 0;
      let updateIndex = 0;
      yield () => {
        // Update one signal and measure propagation
        updateIndex = counter % signals.length;
        signals[updateIndex]!.value = ++counter;
        // Sample a few computeds to force evaluation
        void computeds[0]!.value;
        if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
        void computeds[computeds.length - 1]!.value;
      };
    })
    .args('graphSize', [5, 10, 20, 50]);

    bench('Alien - large graph: $graphSize nodes (single update)', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const signals = Array.from({ length: graphSize }, (_, i) => alienSignal(i));
      const computeds = signals.map((s, i) =>
        alienComputed(() => {
          let sum = s();
          // Each computed depends on up to 3 neighbors
          if (i > 0) sum += signals[i - 1]!();
          if (i < signals.length - 1) sum += signals[i + 1]!();
          if (i > 1) sum += signals[i - 2]!();
          return sum;
        })
      );
      
      // Warm up the graph
      signals[0]!(1);
      void computeds[0]!();
      if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!();
      void computeds[computeds.length - 1]!();
      
      let counter = 0;
      let updateIndex = 0;
      yield () => {
        // Update one signal and measure propagation
        updateIndex = counter % signals.length;
        signals[updateIndex]!(++counter);
        // Sample a few computeds to force evaluation
        void computeds[0]!();
        if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!();
        void computeds[computeds.length - 1]!();
      };
    })
    .args('graphSize', [5, 10, 20, 50]);
  });
});

boxplot(() => {
  group('Rapid Updates Without Reads', () => {
    bench('Preact - rapid update + single read: $updates updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = preactSignal(0);
      const comp = preactComputed(() => sig.value * 2);
      
      // Warm up
      sig.value = 1;
      void comp.value;
      
      let counter = 0;
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig.value = counter * updates + i;
        }
        // Only read once at the end
        void comp.value;
        counter++;
      };
    })
    .args('updates', [10, 50, 100]);

    bench('Lattice - rapid update + single read: $updates updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = latticeSignal(0);
      const comp = latticeComputed(() => sig.value * 2);
      
      // Warm up
      sig.value = 1;
      void comp.value;
      
      let counter = 0;
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig.value = counter * updates + i;
        }
        // Only read once at the end
        void comp.value;
        counter++;
      };
    })
    .args('updates', [10, 50, 100]);

    bench('Alien - rapid update + single read: $updates updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = alienSignal(0);
      const comp = alienComputed(() => sig() * 2);
      
      // Warm up
      sig(1);
      void comp();
      
      let counter = 0;
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig(counter * updates + i);
        }
        // Only read once at the end
        void comp();
        counter++;
      };
    })
    .args('updates', [10, 50, 100]);
  });
});

boxplot(() => {
  group('Read-heavy Workload', () => {
    bench('Preact - single read operation', function* () {
      const readSignal = preactSignal(0);
      const readComputed1 = preactComputed(() => readSignal.value * 2);
      const readComputed2 = preactComputed(() => readSignal.value * 3);
      
      // Warm up
      readSignal.value = 1;
      void readComputed1.value;
      void readComputed2.value;
      
      yield () => {
        void readSignal.value;
        void readComputed1.value;
        void readComputed2.value;
        void readSignal.value;
        void readComputed1.value;
      };
    });

    bench('Lattice - single read operation', function* () {
      const readSignal = latticeSignal(0);
      const readComputed1 = latticeComputed(() => readSignal.value * 2);
      const readComputed2 = latticeComputed(() => readSignal.value * 3);
      
      // Warm up
      readSignal.value = 1;
      void readComputed1.value;
      void readComputed2.value;
      
      yield () => {
        void readSignal.value;
        void readComputed1.value;
        void readComputed2.value;
        void readSignal.value;
        void readComputed1.value;
      };
    });

    bench('Alien - single read operation', function* () {
      const readSignal = alienSignal(0);
      const readComputed1 = alienComputed(() => readSignal() * 2);
      const readComputed2 = alienComputed(() => readSignal() * 3);
      
      // Warm up
      readSignal(1);
      void readComputed1();
      void readComputed2();
      
      yield () => {
        void readSignal();
        void readComputed1();
        void readComputed2();
        void readSignal();
        void readComputed1();
      };
    });
  });
});

boxplot(() => {
  group('Effect Performance', () => {
    bench('Preact - single effect trigger', function* () {
      const effectSignal = preactSignal(0);
      let effectCount = 0;
      const cleanup = preactEffect(() => {
        effectCount++;
        void effectSignal.value;
      });
      
      // Warm up - trigger once
      effectSignal.value = 1;
      
      let counter = 1;
      yield () => {
        effectSignal.value = ++counter;
      };
      
      // Cleanup after benchmark
      cleanup();
    });

    bench('Lattice - single effect trigger', function* () {
      const effectSignal = latticeSignal(0);
      let effectCount = 0;
      const cleanup = latticeEffect(() => {
        effectCount++;
        void effectSignal.value;
      });
      
      // Warm up - trigger once
      effectSignal.value = 1;
      
      let counter = 1;
      yield () => {
        effectSignal.value = ++counter;
      };
      
      // Cleanup after benchmark
      cleanup();
    });

    bench('Alien - single effect trigger', function* () {
      const effectSignal = alienSignal(0);
      let effectCount = 0;
      const cleanup = alienEffect(() => {
        effectCount++;
        void effectSignal();
      });
      
      // Warm up - trigger once
      effectSignal(1);
      
      let counter = 1;
      yield () => {
        effectSignal(++counter);
      };
      
      // Cleanup after benchmark
      cleanup();
    });
  });
});

// Run all benchmarks
await run();
