/**
 * Memory Usage Benchmarks
 * 
 * Tests memory consumption patterns for different signal libraries.
 * Note: Run with --expose-gc flag for accurate measurements
 */

import { describe, bench, beforeEach } from 'vitest';
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


describe('Memory Usage - Signal Creation', () => {
  const COUNT = 10000;

  beforeEach(() => {
    forceGC();
  });

  bench('Preact - 10k signals memory', () => {
    measureMemoryOnce('Preact - 10k signals memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
      // Force references to prevent optimization
      void signals.length;
    });
  });

  bench('Lattice - 10k signals memory', () => {
    measureMemoryOnce('Lattice - 10k signals memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => latticeSignal(i));
      // Force references to prevent optimization
      void signals.length;
    });
  });

  bench('Alien - 10k signals memory', () => {
    measureMemoryOnce('Alien - 10k signals memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
      // Force references to prevent optimization
      void signals.length;
    });
  });
});

describe('Memory Usage - Computed Creation', () => {
  const COUNT = 10000;

  bench('Preact - 10k computeds memory', () => {
    measureMemoryOnce('Preact - 10k computeds memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
      const computeds = signals.map(s => preactComputed(() => s.value * 2));
      // Force evaluation
      computeds.forEach(c => c.value);
      void computeds.length;
    });
  });

  bench('Lattice - 10k computeds memory', () => {
    measureMemoryOnce('Lattice - 10k computeds memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => latticeSignal(i));
      const computeds = signals.map(s => latticeComputed(() => s.value * 2));
      // Force evaluation
      computeds.forEach(c => c.value);
      void computeds.length;
    });
  });

  bench('Alien - 10k computeds memory', () => {
    measureMemoryOnce('Alien - 10k computeds memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
      const computeds = signals.map(s => alienComputed(() => s() * 2));
      // Force evaluation
      computeds.forEach(c => c());
      void computeds.length;
    });
  });
});

describe('Memory Usage - Effect Creation', () => {
  const COUNT = 5000; // Reduced count for effects

  bench('Preact - 5k effects memory', () => {
    measureMemoryOnce('Preact - 5k effects memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
      let counter = 0;
      const effects = signals.map(s => 
        preactEffect(() => { counter += s.value; })
      );
      // Cleanup
      effects.forEach(dispose => dispose());
      void counter;
    });
  });

  bench('Lattice - 5k effects memory', () => {
    measureMemoryOnce('Lattice - 5k effects memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => latticeSignal(i));
      let counter = 0;
      const effects = signals.map(s => 
        latticeEffect(() => { counter += s.value; })
      );
      // Cleanup
      effects.forEach(dispose => dispose());
      void counter;
    });
  });

  bench('Alien - 5k effects memory', () => {
    measureMemoryOnce('Alien - 5k effects memory', () => {
      const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
      let counter = 0;
      const effects = signals.map(s => 
        alienEffect(() => { counter += s(); })
      );
      // Cleanup
      effects.forEach(dispose => dispose());
      void counter;
    });
  });
});

describe('Memory Usage - Large Dependency Tree', () => {
  const WIDTH = 50;
  const HEIGHT = 50;

  bench('Preact - tree memory (50x50)', () => {
    measureMemoryOnce('Preact - tree memory (50x50)', () => {
      const src = preactSignal(1);
      const effects: (() => void)[] = [];
      for (let i = 0; i < WIDTH; i++) {
        let last = src;
        for (let j = 0; j < HEIGHT; j++) {
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
  });

  bench('Lattice - tree memory (50x50)', () => {
    measureMemoryOnce('Lattice - tree memory (50x50)', () => {
      const src = latticeSignal(1);
      const effects: (() => void)[] = [];
      for (let i = 0; i < WIDTH; i++) {
        let last: { value: number } = src;
        for (let j = 0; j < HEIGHT; j++) {
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
  });

  bench('Alien - tree memory (50x50)', () => {
    measureMemoryOnce('Alien - tree memory (50x50)', () => {
      const src = alienSignal(1);
      const effects: (() => void)[] = [];
      for (let i = 0; i < WIDTH; i++) {
        let last = src;
        for (let j = 0; j < HEIGHT; j++) {
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
  });
});

describe('Memory Usage - Cleanup and GC', () => {
  const COUNT = 5000;

  bench('Preact - cleanup efficiency', () => {
    // Create and dispose multiple times
    for (let iter = 0; iter < 5; iter++) {
      const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
      const computeds = signals.map(s => preactComputed(() => s.value * 2));
      const effects = computeds.map(c => preactEffect(() => void c.value));
      
      // Update some values
      for (let i = 0; i < 100; i++) {
        signals[i]!.value = i * 10;
      }
      
      // Cleanup
      effects.forEach(dispose => dispose());
    }
    
    forceGC();
  });

  bench('Lattice - cleanup efficiency', () => {
    // Create and dispose multiple times
    for (let iter = 0; iter < 5; iter++) {
      const signals = Array.from({ length: COUNT }, (_, i) => latticeSignal(i));
      const computeds = signals.map(s => latticeComputed(() => s.value * 2));
      const effects = computeds.map(c => latticeEffect(() => void c.value));
      
      // Update some values
      for (let i = 0; i < 100; i++) {
        signals[i]!.value = i * 10;
      }
      
      // Cleanup
      effects.forEach(dispose => dispose());
    }
    
    forceGC();
  });

  bench('Alien - cleanup efficiency', () => {
    // Create and dispose multiple times
    for (let iter = 0; iter < 5; iter++) {
      const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
      const computeds = signals.map(s => alienComputed(() => s() * 2));
      const effects = computeds.map(c => alienEffect(() => void c()));
      
      // Update some values
      for (let i = 0; i < 100; i++) {
        signals[i]!(i * 10);
      }
      
      // Cleanup
      effects.forEach(dispose => dispose());
    }
    
    forceGC();
  });
});

describe('Memory-Intensive Patterns', () => {
  const SIGNAL_COUNT = 1000;

  bench('Preact - many signals creation/disposal', () => {
    measureMemoryOnce('Preact - many signals creation/disposal', () => {
      // Create many signals
      const signals = Array.from({ length: SIGNAL_COUNT }, (_, i) =>
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
      for (let i = 0; i < 10; i++) {
        signals[i * 10]!.value = i * 1000;
      }
      // Cleanup
      effects.forEach((dispose) => dispose());
    });
  });

  bench('Lattice - many signals creation/disposal', () => {
    measureMemoryOnce('Lattice - many signals creation/disposal', () => {
      // Create many signals
      const signals = Array.from({ length: SIGNAL_COUNT }, (_, i) =>
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
      for (let i = 0; i < 10; i++) {
        signals[i * 10]!.value = i * 1000;
      }
      // Cleanup
      effects.forEach((dispose) => dispose());
    });
  });

  bench('Alien - many signals creation/disposal', () => {
    measureMemoryOnce('Alien - many signals creation/disposal', () => {
      // Create many signals
      const signals = Array.from({ length: SIGNAL_COUNT }, (_, i) =>
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
      for (let i = 0; i < 10; i++) {
        signals[i * 10]!(i * 1000);
      }
      // Cleanup
      effects.forEach((dispose) => dispose());
    });
  });
});
