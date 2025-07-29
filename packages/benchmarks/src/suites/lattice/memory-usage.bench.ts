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
import {
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createSignalAPI,
} from '@lattice/signals';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';

// Create Lattice API instance
const lattice = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
});

// Helper to force garbage collection if available
const forceGC = () => {
  if (global.gc) {
    global.gc();
  }
};


describe('Memory Usage - Signal Creation', () => {
  const COUNT = 10000;

  beforeEach(() => {
    forceGC();
  });

  bench('Preact - 10k signals memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
    // Force references to prevent optimization
    void signals.length;
  });

  bench('Lattice - 10k signals memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => lattice.signal(i));
    // Force references to prevent optimization
    void signals.length;
  });

  bench('Alien - 10k signals memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
    // Force references to prevent optimization
    void signals.length;
  });
});

describe('Memory Usage - Computed Creation', () => {
  const COUNT = 10000;

  bench('Preact - 10k computeds memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
    const computeds = signals.map(s => preactComputed(() => s.value * 2));
    // Force evaluation
    computeds.forEach(c => c.value);
    void computeds.length;
  });

  bench('Lattice - 10k computeds memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => lattice.signal(i));
    const computeds = signals.map(s => lattice.computed(() => s.value * 2));
    // Force evaluation
    computeds.forEach(c => c.value);
    void computeds.length;
  });

  bench('Alien - 10k computeds memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => alienSignal(i));
    const computeds = signals.map(s => alienComputed(() => s() * 2));
    // Force evaluation
    computeds.forEach(c => c());
    void computeds.length;
  });
});

describe('Memory Usage - Effect Creation', () => {
  const COUNT = 5000; // Reduced count for effects

  bench('Preact - 5k effects memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => preactSignal(i));
    let counter = 0;
    const effects = signals.map(s => 
      preactEffect(() => { counter += s.value; })
    );
    
    // Cleanup
    effects.forEach(dispose => dispose());
    void counter;
  });

  bench('Lattice - 5k effects memory', () => {
    const signals = Array.from({ length: COUNT }, (_, i) => lattice.signal(i));
    let counter = 0;
    const effects = signals.map(s => 
      lattice.effect(() => { counter += s.value; })
    );
    
    // Cleanup
    effects.forEach(dispose => dispose());
    void counter;
  });

  bench('Alien - 5k effects memory', () => {
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

describe('Memory Usage - Large Dependency Tree', () => {
  const WIDTH = 50;
  const HEIGHT = 50;

  bench('Preact - tree memory (50x50)', () => {
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

  bench('Lattice - tree memory (50x50)', () => {
    const src = lattice.signal(1);
    const effects: (() => void)[] = [];
    
    for (let i = 0; i < WIDTH; i++) {
      let last: { value: number } = src;
      for (let j = 0; j < HEIGHT; j++) {
        const prev = last;
        last = lattice.computed(() => prev.value + 1);
      }
      effects.push(lattice.effect(() => void last.value));
    }
    
    // Trigger update
    src.value++;
    
    // Cleanup
    effects.forEach(dispose => dispose());
    void effects.length;
  });

  bench('Alien - tree memory (50x50)', () => {
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
      const signals = Array.from({ length: COUNT }, (_, i) => lattice.signal(i));
      const computeds = signals.map(s => lattice.computed(() => s.value * 2));
      const effects = computeds.map(c => lattice.effect(() => void c.value));
      
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