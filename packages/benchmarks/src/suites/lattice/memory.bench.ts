/**
 * Memory Usage Benchmarks
 * 
 * Tests memory consumption patterns for different signal libraries.
 * Note: Run with --expose-gc flag for accurate measurements
 */

import { run, bench, group, boxplot } from 'mitata';

// Type for mitata benchmark state
interface BenchState {
  get(name: string): any;
}
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';
import { measureMemoryOnce, forceGC } from '../../utils/memory';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

// forceGC is imported from utils/memory

boxplot(() => {
  group('Memory Usage - Signal Creation', () => {
    bench('Preact - signals memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Preact - ${count} signals memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => preactSignal(i));
          // Force references to prevent optimization
          void signals.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);

    bench('Lattice - signals memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Lattice - ${count} signals memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => latticeSignal(i));
          // Force references to prevent optimization
          void signals.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);

    bench('Alien - signals memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Alien - ${count} signals memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => alienSignal(i));
          // Force references to prevent optimization
          void signals.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);
  });
});

boxplot(() => {
  group('Memory Usage - Computed Creation', () => {
    bench('Preact - computeds memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Preact - ${count} computeds memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => preactSignal(i));
          const computeds = signals.map(s => preactComputed(() => s.value * 2));
          // Force evaluation
          computeds.forEach(c => c.value);
          void computeds.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);

    bench('Lattice - computeds memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Lattice - ${count} computeds memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => latticeSignal(i));
          const computeds = signals.map(s => latticeComputed(() => s.value * 2));
          // Force evaluation
          computeds.forEach(c => c.value);
          void computeds.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);

    bench('Alien - computeds memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Alien - ${count} computeds memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => alienSignal(i));
          const computeds = signals.map(s => alienComputed(() => s() * 2));
          // Force evaluation
          computeds.forEach(c => c());
          void computeds.length;
        });
      };
    })
    .args('count', [1000, 5000, 10000]);
  });
});

boxplot(() => {
  group('Memory Usage - Effect Creation', () => {
    bench('Preact - effects memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Preact - ${count} effects memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => preactSignal(i));
          let counter = 0;
          const effects = signals.map(s => 
            preactEffect(() => { counter += s.value; })
          );
          // Cleanup
          effects.forEach(dispose => dispose());
          void counter;
        });
      };
    })
    .args('count', [1000, 2500, 5000]);

    bench('Lattice - effects memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Lattice - ${count} effects memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => latticeSignal(i));
          let counter = 0;
          const effects = signals.map(s => 
            latticeEffect(() => { counter += s.value; })
          );
          // Cleanup
          effects.forEach(dispose => dispose());
          void counter;
        });
      };
    })
    .args('count', [1000, 2500, 5000]);

    bench('Alien - effects memory: $count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Alien - ${count} effects memory`, () => {
          const signals = Array.from({ length: count }, (_, i) => alienSignal(i));
          let counter = 0;
          const effects = signals.map(s => 
            alienEffect(() => { counter += s(); })
          );
          // Cleanup
          effects.forEach(dispose => dispose());
          void counter;
        });
      };
    })
    .args('count', [1000, 2500, 5000]);
  });
});

boxplot(() => {
  group('Memory Usage - Large Dependency Tree', () => {
    bench('Preact - tree memory: $w × $h', function* (state: BenchState) {
      forceGC();
      const w = state.get('w');
      const h = state.get('h');
      yield () => {
        measureMemoryOnce(`Preact - tree memory (${w}x${h})`, () => {
          const src = preactSignal(1);
          const effects: (() => void)[] = [];
          for (let i = 0; i < w; i++) {
            let last = src;
            for (let j = 0; j < h; j++) {
              const prev = last;
              last = preactComputed(() => prev.value + 1);
            }
            effects.push(preactEffect(() => void last.value));
          }
          // Trigger update
          src.value++;
          // Cleanup
          effects.forEach(dispose => dispose());
          void effects.length;
        });
      };
    })
    .args('w', [10, 25, 50])
    .args('h', [10, 25, 50]);

    bench('Lattice - tree memory: $w × $h', function* (state: BenchState) {
      forceGC();
      const w = state.get('w');
      const h = state.get('h');
      yield () => {
        measureMemoryOnce(`Lattice - tree memory (${w}x${h})`, () => {
          const src = latticeSignal(1);
          const effects: (() => void)[] = [];
          for (let i = 0; i < w; i++) {
            let last: { value: number } = src;
            for (let j = 0; j < h; j++) {
              const prev = last;
              last = latticeComputed(() => prev.value + 1);
            }
            effects.push(latticeEffect(() => void last.value));
          }
          // Trigger update
          src.value++;
          // Cleanup
          effects.forEach(dispose => dispose());
          void effects.length;
        });
      };
    })
    .args('w', [10, 25, 50])
    .args('h', [10, 25, 50]);

    bench('Alien - tree memory: $w × $h', function* (state: BenchState) {
      forceGC();
      const w = state.get('w');
      const h = state.get('h');
      yield () => {
        measureMemoryOnce(`Alien - tree memory (${w}x${h})`, () => {
          const src = alienSignal(1);
          const effects: (() => void)[] = [];
          for (let i = 0; i < w; i++) {
            let last = src;
            for (let j = 0; j < h; j++) {
              const prev = last;
              last = alienComputed(() => prev() + 1);
            }
            effects.push(alienEffect(() => void last()));
          }
          // Trigger update
          src(src() + 1);
          // Cleanup
          effects.forEach(dispose => dispose());
          void effects.length;
        });
      };
    })
    .args('w', [10, 25, 50])
    .args('h', [10, 25, 50]);
  });
});

boxplot(() => {
  group('Memory Usage - Cleanup and GC', () => {
    bench('Preact - cleanup efficiency: $iterations iterations, $count signals', function* (state: BenchState) {
      forceGC();
      const iterations = state.get('iterations');
      const count = state.get('count');
      yield () => {
        // Create and dispose multiple times
        for (let iter = 0; iter < iterations; iter++) {
          const signals = Array.from({ length: count }, (_, i) => preactSignal(i));
          const computeds = signals.map(s => preactComputed(() => s.value * 2));
          const effects = computeds.map(c => preactEffect(() => void c.value));
          
          // Update some values
          for (let i = 0; i < Math.min(100, count); i++) {
            signals[i]!.value = i * 10;
          }
          
          // Cleanup
          effects.forEach(dispose => dispose());
        }
        
        forceGC();
      };
    })
    .args('iterations', [3, 5, 10])
    .args('count', [1000, 2500, 5000]);

    bench('Lattice - cleanup efficiency: $iterations iterations, $count signals', function* (state: BenchState) {
      forceGC();
      const iterations = state.get('iterations');
      const count = state.get('count');
      yield () => {
        // Create and dispose multiple times
        for (let iter = 0; iter < iterations; iter++) {
          const signals = Array.from({ length: count }, (_, i) => latticeSignal(i));
          const computeds = signals.map(s => latticeComputed(() => s.value * 2));
          const effects = computeds.map(c => latticeEffect(() => void c.value));
          
          // Update some values
          for (let i = 0; i < Math.min(100, count); i++) {
            signals[i]!.value = i * 10;
          }
          
          // Cleanup
          effects.forEach(dispose => dispose());
        }
        
        forceGC();
      };
    })
    .args('iterations', [3, 5, 10])
    .args('count', [1000, 2500, 5000]);

    bench('Alien - cleanup efficiency: $iterations iterations, $count signals', function* (state: BenchState) {
      forceGC();
      const iterations = state.get('iterations');
      const count = state.get('count');
      yield () => {
        // Create and dispose multiple times
        for (let iter = 0; iter < iterations; iter++) {
          const signals = Array.from({ length: count }, (_, i) => alienSignal(i));
          const computeds = signals.map(s => alienComputed(() => s() * 2));
          const effects = computeds.map(c => alienEffect(() => void c()));
          
          // Update some values
          for (let i = 0; i < Math.min(100, count); i++) {
            signals[i]!(i * 10);
          }
          
          // Cleanup
          effects.forEach(dispose => dispose());
        }
        
        forceGC();
      };
    })
    .args('iterations', [3, 5, 10])
    .args('count', [1000, 2500, 5000]);
  });
});

boxplot(() => {
  group('Memory-Intensive Patterns', () => {
    bench('Preact - neighbor signals: $count count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Preact - ${count} neighbor signals`, () => {
          // Create many signals
          const signals = Array.from({ length: count }, (_, i) =>
            preactSignal(i)
          );
          // Create computeds that depend on neighbors
          const computeds = signals.map((s, i) =>
            preactComputed(() => {
              let sum = s.value;
              if (i > 0) sum += signals[i - 1]!.value;
              if (i < signals.length - 1) sum += signals[i + 1]!.value;
              return sum;
            })
          );
          // Create effects for each computed
          const effects = computeds.map((c) => preactEffect(() => void c.value));
          // Trigger some updates
          for (let i = 0; i < Math.min(10, count / 10); i++) {
            signals[i * 10]!.value = i * 1000;
          }
          // Cleanup
          effects.forEach((dispose) => dispose());
        });
      };
    })
    .args('count', [100, 500, 1000]);

    bench('Lattice - neighbor signals: $count count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Lattice - ${count} neighbor signals`, () => {
          // Create many signals
          const signals = Array.from({ length: count }, (_, i) =>
            latticeSignal(i)
          );
          // Create computeds that depend on neighbors
          const computeds = signals.map((s, i) =>
            latticeComputed(() => {
              let sum = s.value;
              if (i > 0) sum += signals[i - 1]!.value;
              if (i < signals.length - 1) sum += signals[i + 1]!.value;
              return sum;
            })
          );
          // Create effects for each computed
          const effects = computeds.map((c) => latticeEffect(() => void c.value));
          // Trigger some updates
          for (let i = 0; i < Math.min(10, count / 10); i++) {
            signals[i * 10]!.value = i * 1000;
          }
          // Cleanup
          effects.forEach((dispose) => dispose());
        });
      };
    })
    .args('count', [100, 500, 1000]);

    bench('Alien - neighbor signals: $count count', function* (state: BenchState) {
      forceGC();
      const count = state.get('count');
      yield () => {
        measureMemoryOnce(`Alien - ${count} neighbor signals`, () => {
          // Create many signals
          const signals = Array.from({ length: count }, (_, i) =>
            alienSignal(i)
          );
          // Create computeds that depend on neighbors
          const computeds = signals.map((s, i) =>
            alienComputed(() => {
              let sum = s();
              if (i > 0) sum += signals[i - 1]!();
              if (i < signals.length - 1) sum += signals[i + 1]!();
              return sum;
            })
          );
          // Create effects for each computed
          const effects = computeds.map((c) => alienEffect(() => void c()));
          // Trigger some updates
          for (let i = 0; i < Math.min(10, count / 10); i++) {
            signals[i * 10]!(i * 1000);
          }
          // Cleanup
          effects.forEach((dispose) => dispose());
        });
      };
    })
    .args('count', [100, 500, 1000]);
  });
});

// Run all benchmarks with markdown output for better visualization
await run({ format: 'markdown' });
