/**
 * Core Signals Library Performance Benchmarks
 *
 * Compares performance between:
 * 1. Preact signals (baseline)
 * 2. Lattice signals (current implementation)
 * 3. Alien signals (Vue 3 inspired push-pull algorithm)
 */

import { run, bench, group, barplot, summary } from 'mitata';

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

group('Basic Operations', () => {
  summary(() => {
    barplot(() => {
      bench(
        'Preact - write + read: $iterations iterations',
        function* (state: BenchState) {
          const iterations = state.get('iterations');
          const count = preactSignal(0);

          yield () => {
            let sum = 0;
            for (let i = 0; i < iterations; i++) {
              count.value = i;
              sum += count.value; // Prevent DCE by accumulating
            }
            return sum; // Return value to prevent DCE
          };
        }
      )
      .args('iterations', [1000, 5000, 10000])
      .gc('inner'); // Run GC between iterations

      bench(
        'Lattice - write + read: $iterations iterations',
        function* (state: BenchState) {
          const iterations = state.get('iterations');
          const count = latticeSignal(0);

          yield () => {
            let sum = 0;
            for (let i = 0; i < iterations; i++) {
              count.value = i;
              sum += count.value; // Prevent DCE by accumulating
            }
            return sum; // Return value to prevent DCE
          };
        }
      )
      .args('iterations', [1000, 5000, 10000])
      .gc('inner'); // Run GC between iterations

      bench(
        'Alien - write + read: $iterations iterations',
        function* (state: BenchState) {
          const iterations = state.get('iterations');
          const count = alienSignal(0);

          yield () => {
            let sum = 0;
            for (let i = 0; i < iterations; i++) {
              count(i);
              sum += count(); // Prevent DCE by accumulating
            }
            return sum; // Return value to prevent DCE
          };
        }
      )
      .args('iterations', [1000, 5000, 10000])
      .gc('inner'); // Run GC between iterations
    });
  });
});

group('Computed Chain', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - chain depth: $depth', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = preactSignal(0);
        let last = source;

        // Build chain of specified depth
        for (let i = 0; i < depth; i++) {
          const prev = last;
          last = preactComputed(() => prev.value * 2);
        }

        // Warm up the chain to establish dependencies
        source.value = 1;
        void last.value;

        yield () => {
          let sum = 0;
          for (let i = 0; i < 10000; i++) {
            source.value = i;
            sum += last.value;
          }
          return sum;
        };
      })
      .args('depth', [2, 3, 5, 10])
      .gc('inner'); // GC between different depth configurations

      bench('Lattice - chain depth: $depth', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = latticeSignal(0);
        let last: { value: number } = source;

        // Build chain of specified depth
        for (let i = 0; i < depth; i++) {
          const prev = last;
          last = latticeComputed(() => prev.value * 2);
        }

        // Warm up the chain to establish dependencies
        source.value = 1;
        void last.value;

        yield () => {
          let sum = 0;
          for (let i = 0; i < 10000; i++) {
            source.value = i;
            sum += last.value;
          }
          return sum;
        };
      })
        .args('depth', [2, 3, 5, 10])
        .gc('inner'); // GC between different depth configurations

      bench('Alien - chain depth: $depth', function* (state: BenchState) {
        const depth = state.get('depth');
        const source = alienSignal(0);
        let last = source;

        // Build chain of specified depth
        for (let i = 0; i < depth; i++) {
          const prev = last;
          last = alienComputed(() => prev() * 2);
        }

        // Warm up the chain to establish dependencies
        source(1);
        void last();

        yield () => {
          let sum = 0;
          for (let i = 0; i < 10000; i++) {
            source(i);
            sum += last();
          }
          return sum;
        };
      })
        .args('depth', [2, 3, 5, 10])
        .gc('inner'); // GC between different depth configurations
    });
  });
});

group('Diamond Dependency', () => {
  summary(() => {
    barplot(() => {
      bench(
        'Preact - diamond: $iterations iterations',
        function* (state: BenchState) {
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
        }
      ).args('iterations', [1000, 5000, 10000]);

      bench(
        'Lattice - diamond: $iterations iterations',
        function* (state: BenchState) {
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
        }
      ).args('iterations', [1000, 5000, 10000]);

      bench(
        'Alien - diamond: $iterations iterations',
        function* (state: BenchState) {
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
        }
      ).args('iterations', [1000, 5000, 10000]);
    });
  });
});

group('Batch Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - batch $count signals', function* (state: BenchState) {
        const count = state.get('count');
        const signals = Array.from({ length: count }, () => preactSignal(0));
        const sum = preactComputed(() =>
          signals.reduce((acc, s) => acc + s.value, 0)
        );

        yield () => {
          for (let i = 0; i < 1000; i++) {
            preactBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void sum.value;
          }
        };
      }).args('count', [3, 5, 10]);

      bench('Lattice - batch $count signals', function* (state: BenchState) {
        const count = state.get('count');
        const signals = Array.from({ length: count }, () => latticeSignal(0));
        const sum = latticeComputed(() =>
          signals.reduce((acc, s) => acc + s.value, 0)
        );

        yield () => {
          for (let i = 0; i < 1000; i++) {
            latticeBatch(() => {
              signals.forEach((s, idx) => {
                s.value = i * (idx + 1);
              });
            });
            void sum.value;
          }
        };
      }).args('count', [3, 5, 10]);

      bench('Alien - batch $count signals', function* (state: BenchState) {
        const count = state.get('count');
        const signals = Array.from({ length: count }, () => alienSignal(0));
        const sum = alienComputed(() =>
          signals.reduce((acc, s) => acc + s(), 0)
        );

        yield () => {
          for (let i = 0; i < 1000; i++) {
            alienStartBatch();
            signals.forEach((s, idx) => {
              s(i * (idx + 1));
            });
            alienEndBatch();
            void sum();
          }
        };
      }).args('count', [3, 5, 10]);
    });
  });
});

group('Wide Fan-out', () => {
  summary(() => {
    barplot(() => {
      bench(
        'Preact - fan-out: $width computeds',
        function* (state: BenchState) {
          const width = state.get('width');
          const source = preactSignal(0);
          const computeds = Array.from({ length: width }, (_, i) =>
            preactComputed(() => source.value * (i + 1))
          );
          const aggregated = preactComputed(() =>
            computeds.reduce((sum, c) => sum + c.value, 0)
          );

          yield () => {
            for (let i = 0; i < 1000; i++) {
              source.value = i;
              void aggregated.value;
            }
          };
        }
      ).args('width', [10, 50, 100]);

      bench(
        'Lattice - fan-out: $width computeds',
        function* (state: BenchState) {
          const width = state.get('width');
          const source = latticeSignal(0);
          const computeds = Array.from({ length: width }, (_, i) =>
            latticeComputed(() => source.value * (i + 1))
          );
          const aggregated = latticeComputed(() =>
            computeds.reduce((sum, c) => sum + c.value, 0)
          );

          yield () => {
            for (let i = 0; i < 1000; i++) {
              source.value = i;
              void aggregated.value;
            }
          };
        }
      ).args('width', [10, 50, 100]);

      bench('Alien - fan-out: $width computeds', function* (state: BenchState) {
        const width = state.get('width');
        const source = alienSignal(0);
        const computeds = Array.from({ length: width }, (_, i) =>
          alienComputed(() => source() * (i + 1))
        );
        const aggregated = alienComputed(() =>
          computeds.reduce((sum, c) => sum + c(), 0)
        );

        yield () => {
          for (let i = 0; i < 1000; i++) {
            source(i);
            void aggregated();
          }
        };
      }).args('width', [10, 50, 100]);
    });
  });
});

group('Effect Triggers', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - $count effect updates', function* (state: BenchState) {
        const count = state.get('count');
        const signal = preactSignal(0);
        let counter = 0;
        const cleanup = preactEffect(() => {
          counter += signal.value;
        });

        yield () => {
          for (let i = 0; i < count; i++) {
            signal.value = i;
          }
        };

        cleanup();
      }).args('count', [100, 500, 1000]);

      bench('Lattice - $count effect updates', function* (state: BenchState) {
        const count = state.get('count');
        const signal = latticeSignal(0);
        let counter = 0;
        const cleanup = latticeEffect(() => {
          counter += signal.value;
        });

        yield () => {
          for (let i = 0; i < count; i++) {
            signal.value = i;
          }
        };

        cleanup();
      }).args('count', [100, 500, 1000]);

      bench('Alien - $count effect updates', function* (state: BenchState) {
        const count = state.get('count');
        const signal = alienSignal(0);
        let counter = 0;
        const cleanup = alienEffect(() => {
          counter += signal();
        });

        yield () => {
          for (let i = 0; i < count; i++) {
            signal(i);
          }
        };

        cleanup();
      }).args('count', [100, 500, 1000]);
    });
  });
});

// Advanced benchmark group with better DCE prevention and memory testing
group('Memory Pressure', () => {
  summary(() => {
    bench('Preact - create/dispose $objects objects', function* (state: BenchState) {
      const objects = state.get('objects');
      
      yield {
        // Computed property to generate unique iterations
        [0]() {
          return Array.from({ length: objects }, (_, i) => i);
        },
        
        bench(indices: number[]) {
          const signals = indices.map((i: number) => preactSignal(i));
          const computeds = signals.map((s) => preactComputed(() => s.value * 2));
          const effects = computeds.map((c) => preactEffect(() => void c.value));
          
          // Trigger some updates
          signals.forEach((s, i) => s.value = i * 2);
          
          // Cleanup
          effects.forEach((e) => e());
          
          // Return something to prevent DCE
          return signals.length + computeds.length;
        }
      };
    })
    .range('objects', 100, 1000, 100)  // Use range for continuous exploration
    .gc('inner');  // GC before each iteration for memory-intensive operations
    
    bench(
      'Lattice - create/dispose $objects objects',
      function* (state: BenchState) {
        const objects = state.get('objects');

        yield {
          [0]() {
            return Array.from({ length: objects }, (_, i) => i);
          },

          bench(indices: number[]) {
            const signals = indices.map((i: number) => latticeSignal(i));
            const computeds = signals.map((s) =>
              latticeComputed(() => s.value * 2)
            );
            const effects = computeds.map((c) =>
              latticeEffect(() => void c.value)
            );

            // Trigger some updates
            signals.forEach((s, i) => (s.value = i * 2));

            // Cleanup
            effects.forEach((e) => e());

            return signals.length + computeds.length;
          },
        };
      }
    )
      .range('objects', 100, 1000, 100)
      .gc('inner');
    
    bench(
      'Alien - create/dispose $objects objects',
      function* (state: BenchState) {
        const objects = state.get('objects');

        yield {
          [0]() {
            return Array.from({ length: objects }, (_, i) => i);
          },

          bench(indices: number[]) {
            const signals = indices.map((i: number) => alienSignal(i));
            const computeds = signals.map((s) => alienComputed(() => s() * 2));
            const effects = computeds.map((c) => alienEffect(() => void c()));

            // Trigger some updates
            signals.forEach((s, i) => s(i * 2));

            // Cleanup
            effects.forEach((e) => e());

            return signals.length + computeds.length;
          },
        };
      }
    )
      .range('objects', 100, 1000, 100)
      .gc('inner');
  });
});

// Concurrent updates benchmark
group('Concurrent Updates', () => {
  summary(() => {
    bench('Preact - concurrent: $concurrency', function* (state: BenchState) {
      const concurrency = state.get('concurrency');
      const iterations = 1000;
      
      yield {
        concurrency,
        async bench() {
          const signals = Array.from({ length: concurrency }, () => preactSignal(0));
          const promises = signals.map((signal, idx) => 
            Promise.resolve().then(() => {
              for (let i = 0; i < iterations; i++) {
                signal.value = i + idx;
              }
              return signal.value;
            })
          );
          
          const results = await Promise.all(promises);
          return results.reduce((a, b) => a + b, 0);
        }
      };
    })
    .args('concurrency', [1, 5, 10, 20]);
    
    bench('Lattice - concurrent: $concurrency', function* (state: BenchState) {
      const concurrency = state.get('concurrency');
      const iterations = 1000;
      
      yield {
        concurrency,
        async bench() {
          const signals = Array.from({ length: concurrency }, () => latticeSignal(0));
          const promises = signals.map((signal, idx) => 
            Promise.resolve().then(() => {
              for (let i = 0; i < iterations; i++) {
                signal.value = i + idx;
              }
              return signal.value;
            })
          );
          
          const results = await Promise.all(promises);
          return results.reduce((a, b) => a + b, 0);
        }
      };
    })
    .args('concurrency', [1, 5, 10, 20]);
    
    bench('Alien - concurrent: $concurrency', function* (state: BenchState) {
      const concurrency = state.get('concurrency');
      const iterations = 1000;
      
      yield {
        concurrency,
        async bench() {
          const signals = Array.from({ length: concurrency }, () => alienSignal(0));
          const promises = signals.map((signal, idx) => 
            Promise.resolve().then(() => {
              for (let i = 0; i < iterations; i++) {
                signal(i + idx);
              }
              return signal();
            })
          );
          
          const results = await Promise.all(promises);
          return results.reduce((a, b) => a + b, 0);
        }
      };
    })
    .args('concurrency', [1, 5, 10, 20]);
  });
});

// Run all benchmarks
await run();