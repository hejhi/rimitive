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
    bench('Preact - signal ops: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const count = preactSignal(0);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          count.value = i;
          void count.value; // Read
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Lattice - signal ops: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const count = latticeSignal(0);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          count.value = i;
          void count.value; // Read
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Alien - signal ops: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const count = alienSignal(0);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          count(i);
          void count(); // Read
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);
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
    bench('Preact - deep tree: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const root = preactSignal(0);
      const a1 = preactComputed(() => root.value * 2);
      const a2 = preactComputed(() => root.value * 3);
      const b1 = preactComputed(() => a1.value + a2.value);
      const b2 = preactComputed(() => a1.value - a2.value);
      const c1 = preactComputed(() => b1.value * b2.value);
      const c2 = preactComputed(() => b1.value / (b2.value || 1));
      const result = preactComputed(() => c1.value + c2.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          root.value = i + 1; // Avoid divide by zero
          void result.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Lattice - deep tree: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const root = latticeSignal(0);
      const a1 = latticeComputed(() => root.value * 2);
      const a2 = latticeComputed(() => root.value * 3);
      const b1 = latticeComputed(() => a1.value + a2.value);
      const b2 = latticeComputed(() => a1.value - a2.value);
      const c1 = latticeComputed(() => b1.value * b2.value);
      const c2 = latticeComputed(() => b1.value / (b2.value || 1));
      const result = latticeComputed(() => c1.value + c2.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          root.value = i + 1; // Avoid divide by zero
          void result.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Alien - deep tree: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const root = alienSignal(0);
      const a1 = alienComputed(() => root() * 2);
      const a2 = alienComputed(() => root() * 3);
      const b1 = alienComputed(() => a1() + a2());
      const b2 = alienComputed(() => a1() - a2());
      const c1 = alienComputed(() => b1() * b2());
      const c2 = alienComputed(() => b1() / (b2() || 1));
      const result = alienComputed(() => c1() + c2());
      yield () => {
        for (let i = 0; i < iterations; i++) {
          root(i + 1); // Avoid divide by zero
          void result();
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);
  });
});

boxplot(() => {
  group('Diamond Pattern', () => {
    bench('Preact - diamond: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const source = preactSignal(0);
      const left = preactComputed(() => source.value * 2);
      const right = preactComputed(() => source.value * 3);
      const bottom = preactComputed(() => left.value + right.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source.value = i;
          void bottom.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Lattice - diamond: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const source = latticeSignal(0);
      const left = latticeComputed(() => source.value * 2);
      const right = latticeComputed(() => source.value * 3);
      const bottom = latticeComputed(() => left.value + right.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source.value = i;
          void bottom.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Alien - diamond: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const source = alienSignal(0);
      const left = alienComputed(() => source() * 2);
      const right = alienComputed(() => source() * 3);
      const bottom = alienComputed(() => left() + right());
      yield () => {
        for (let i = 0; i < iterations; i++) {
          source(i);
          void bottom();
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);
  });
});

boxplot(() => {
  group('Batch Updates', () => {
    bench('Preact - batch updates: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const s1 = preactSignal(0);
      const s2 = preactSignal(0);
      const s3 = preactSignal(0);
      const sum = preactComputed(() => s1.value + s2.value + s3.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          preactBatch(() => {
            s1.value = i;
            s2.value = i * 2;
            s3.value = i * 3;
          });
          void sum.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Lattice - batch updates: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const s1 = latticeSignal(0);
      const s2 = latticeSignal(0);
      const s3 = latticeSignal(0);
      const sum = latticeComputed(() => s1.value + s2.value + s3.value);
      yield () => {
        for (let i = 0; i < iterations; i++) {
          latticeBatch(() => {
            s1.value = i;
            s2.value = i * 2;
            s3.value = i * 3;
          });
          void sum.value;
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);

    bench('Alien - batch updates: $iterations', function* (state: BenchState) {
      const iterations = state.get('iterations');
      const s1 = alienSignal(0);
      const s2 = alienSignal(0);
      const s3 = alienSignal(0);
      const sum = alienComputed(() => s1() + s2() + s3());
      yield () => {
        for (let i = 0; i < iterations; i++) {
          alienStartBatch();
          s1(i);
          s2(i * 2);
          s3(i * 3);
          alienEndBatch();
          void sum();
        }
      };
    })
    .args('iterations', [100, 1000, 10000]);
  });
});

boxplot(() => {
  group('Large Dependency Graph', () => {
    bench('Preact - large graph: $graphSize nodes, $iterations ops', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      const signals = Array.from({ length: graphSize }, (_, i) => preactSignal(i));
      const computeds = signals.map((s, i) =>
        preactComputed(() => {
          let sum = s.value;
          // Each computed depends on 3 signals
          if (i > 0) sum += signals[i - 1]!.value;
          if (i < signals.length - 1) sum += signals[i + 1]!.value;
          if (i > 1) sum += signals[i - 2]!.value;
          return sum;
        })
      );
      yield () => {
        for (let i = 0; i < iterations; i++) {
          signals[i % signals.length]!.value = i;
          // Sample a few computeds
          void computeds[0]!.value;
          if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
          void computeds[computeds.length - 1]!.value;
        }
      };
    })
    .args('graphSize', [5, 10, 20])
    .args('iterations', [100, 1000]);

    bench('Lattice - large graph: $graphSize nodes, $iterations ops', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      const signals = Array.from({ length: graphSize }, (_, i) => latticeSignal(i));
      const computeds = signals.map((s, i) =>
        latticeComputed(() => {
          let sum = s.value;
          // Each computed depends on 3 signals
          if (i > 0) sum += signals[i - 1]!.value;
          if (i < signals.length - 1) sum += signals[i + 1]!.value;
          if (i > 1) sum += signals[i - 2]!.value;
          return sum;
        })
      );
      yield () => {
        for (let i = 0; i < iterations; i++) {
          signals[i % signals.length]!.value = i;
          // Sample a few computeds
          void computeds[0]!.value;
          if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!.value;
          void computeds[computeds.length - 1]!.value;
        }
      };
    })
    .args('graphSize', [5, 10, 20])
    .args('iterations', [100, 1000]);

    bench('Alien - large graph: $graphSize nodes, $iterations ops', function* (state: BenchState) {
      const graphSize = state.get('graphSize');
      const iterations = state.get('iterations');
      const signals = Array.from({ length: graphSize }, (_, i) => alienSignal(i));
      const computeds = signals.map((s, i) =>
        alienComputed(() => {
          let sum = s();
          // Each computed depends on 3 signals
          if (i > 0) sum += signals[i - 1]!();
          if (i < signals.length - 1) sum += signals[i + 1]!();
          if (i > 1) sum += signals[i - 2]!();
          return sum;
        })
      );
      yield () => {
        for (let i = 0; i < iterations; i++) {
          signals[i % signals.length]!(i);
          // Sample a few computeds
          void computeds[0]!();
          if (computeds.length > 5) void computeds[Math.floor(computeds.length / 2)]!();
          void computeds[computeds.length - 1]!();
        }
      };
    })
    .args('graphSize', [5, 10, 20])
    .args('iterations', [100, 1000]);
  });
});

boxplot(() => {
  group('Rapid Updates Without Reads', () => {
    bench('Preact - rapid updates: $updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = preactSignal(0);
      const comp = preactComputed(() => sig.value * 2);
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig.value = i;
        }
        // Only read once at the end
        void comp.value;
      };
    })
    .args('updates', [100, 1000, 10000]);

    bench('Lattice - rapid updates: $updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = latticeSignal(0);
      const comp = latticeComputed(() => sig.value * 2);
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig.value = i;
        }
        // Only read once at the end
        void comp.value;
      };
    })
    .args('updates', [100, 1000, 10000]);

    bench('Alien - rapid updates: $updates', function* (state: BenchState) {
      const updates = state.get('updates');
      const sig = alienSignal(0);
      const comp = alienComputed(() => sig() * 2);
      yield () => {
        for (let i = 0; i < updates; i++) {
          sig(i);
        }
        // Only read once at the end
        void comp();
      };
    })
    .args('updates', [100, 1000, 10000]);
  });
});

boxplot(() => {
  group('Read-heavy Workload', () => {
    bench('Preact - many reads: $reads', function* (state: BenchState) {
      const reads = state.get('reads');
      const readSignal = preactSignal(0);
      const readComputed1 = preactComputed(() => readSignal.value * 2);
      const readComputed2 = preactComputed(() => readSignal.value * 3);
      yield () => {
        for (let i = 0; i < reads; i++) {
          void readSignal.value;
          void readComputed1.value;
          void readComputed2.value;
          void readSignal.value;
          void readComputed1.value;
        }
      };
    })
    .args('reads', [100, 1000, 10000]);

    bench('Lattice - many reads: $reads', function* (state: BenchState) {
      const reads = state.get('reads');
      const readSignal = latticeSignal(0);
      const readComputed1 = latticeComputed(() => readSignal.value * 2);
      const readComputed2 = latticeComputed(() => readSignal.value * 3);
      yield () => {
        for (let i = 0; i < reads; i++) {
          void readSignal.value;
          void readComputed1.value;
          void readComputed2.value;
          void readSignal.value;
          void readComputed1.value;
        }
      };
    })
    .args('reads', [100, 1000, 10000]);

    bench('Alien - many reads: $reads', function* (state: BenchState) {
      const reads = state.get('reads');
      const readSignal = alienSignal(0);
      const readComputed1 = alienComputed(() => readSignal() * 2);
      const readComputed2 = alienComputed(() => readSignal() * 3);
      yield () => {
        for (let i = 0; i < reads; i++) {
          void readSignal();
          void readComputed1();
          void readComputed2();
          void readSignal();
          void readComputed1();
        }
      };
    })
    .args('reads', [100, 1000, 10000]);
  });
});

boxplot(() => {
  group('Effect Performance', () => {
    bench('Preact - effect triggers: $triggers', function* (state: BenchState) {
      const triggers = state.get('triggers');
      const effectSignal = preactSignal(0);
      const cleanup = preactEffect(() => {
        void effectSignal.value;
      });
      yield () => {
        for (let i = 0; i < triggers; i++) {
          effectSignal.value = i;
        }
      };
      cleanup();
    })
    .args('triggers', [100, 1000, 5000]);

    bench('Lattice - effect triggers: $triggers', function* (state: BenchState) {
      const triggers = state.get('triggers');
      const effectSignal = latticeSignal(0);
      const cleanup = latticeEffect(() => {
        void effectSignal.value;
      });
      yield () => {
        for (let i = 0; i < triggers; i++) {
          effectSignal.value = i;
        }
      };
      cleanup();
    })
    .args('triggers', [100, 1000, 5000]);

    bench('Alien - effect triggers: $triggers', function* (state: BenchState) {
      const triggers = state.get('triggers');
      const effectSignal = alienSignal(0);
      const cleanup = alienEffect(() => {
        void effectSignal();
      });
      yield () => {
        for (let i = 0; i < triggers; i++) {
          effectSignal(i);
        }
      };
      cleanup();
    })
    .args('triggers', [100, 1000, 5000]);
  });
});

// Run all benchmarks
await run();
