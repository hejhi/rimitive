/**
 * Advanced Pattern Benchmarks
 * 
 * Tests scenarios from alien-signals benchmarks that aren't covered
 * in our standard comparison suite:
 * 1. Grid propagation patterns
 * 2. Complex object updates
 * 3. Deep propagation chains
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';

// Create Lattice API instance
const {
  signal: latticeSignal,
  computed: latticeComputed,
  effect: latticeEffect
} = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
}, createDefaultContext());

describe('Grid Propagation Pattern (10x10)', () => {
  const WIDTH = 10;
  const HEIGHT = 10;

  bench('Preact - grid propagation', () => {
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
    
    // Trigger propagation
    src.value++;
    
    // Cleanup
    effects.forEach(dispose => dispose());
  });

  bench('Lattice - grid propagation', () => {
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
    
    // Trigger propagation
    src.value++;
    
    // Cleanup
    effects.forEach(dispose => dispose());
  });

  bench('Alien - grid propagation', () => {
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
    
    // Trigger propagation
    src(src() + 1);
    
    // Cleanup
    effects.forEach(dispose => dispose());
  });
});

describe('Deep Chain Propagation (100 levels)', () => {
  const DEPTH = 100;

  bench('Preact - deep chain', () => {
    const src = preactSignal(0);
    let last = src;
    
    // Create deep chain
    for (let i = 0; i < DEPTH; i++) {
      const prev = last;
      last = preactComputed(() => prev.value + 1);
    }
    
    const dispose = preactEffect(() => void last.value);
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      src.value = i;
    }
    
    dispose();
  });

  bench('Lattice - deep chain', () => {
    const src = latticeSignal(0);
    let last: { value: number } = src;
    
    // Create deep chain
    for (let i = 0; i < DEPTH; i++) {
      const prev = last;
      last = latticeComputed(() => prev.value + 1);
    }
    
    const dispose = latticeEffect(() => void last.value);
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      src.value = i;
    }
    
    dispose();
  });

  bench('Alien - deep chain', () => {
    const src = alienSignal(0);
    let last = src;
    
    // Create deep chain
    for (let i = 0; i < DEPTH; i++) {
      const prev = last;
      last = alienComputed(() => prev() + 1);
    }
    
    const dispose = alienEffect(() => void last());
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      src(i);
    }
    
    dispose();
  });
});

describe('Complex Object Updates', () => {
  interface ComplexObject {
    id: number;
    data: {
      value: number;
      metadata: {
        timestamp: number;
        tags: string[];
      };
    };
  }

  const createComplexObject = (id: number): ComplexObject => ({
    id,
    data: {
      value: id * 10,
      metadata: {
        // Deterministic value to avoid timer noise in hot paths
        timestamp: id * 1000,
        tags: [`tag-${id}`, `category-${id % 5}`],
      },
    },
  });

  bench('Preact - complex objects', () => {
    const objects = Array.from({ length: 50 }, (_, i) => 
      preactSignal(createComplexObject(i))
    );
    
    const aggregated = preactComputed(() => {
      return objects.reduce((sum, obj) => sum + obj.value.data.value, 0);
    });
    
    const dispose = preactEffect(() => void aggregated.value);
    
    // Update objects
    for (let i = 0; i < 100; i++) {
      const idx = i % objects.length;
      objects[idx]!.value = createComplexObject(idx + i);
    }
    
    dispose();
  });

  bench('Lattice - complex objects', () => {
    const objects = Array.from({ length: 50 }, (_, i) => 
      latticeSignal(createComplexObject(i))
    );
    
    const aggregated = latticeComputed(() => {
      return objects.reduce((sum, obj) => sum + obj.value.data.value, 0);
    });
    
    const dispose = latticeEffect(() => void aggregated.value);
    
    // Update objects
    for (let i = 0; i < 100; i++) {
      const idx = i % objects.length;
      objects[idx]!.value = createComplexObject(idx + i);
    }
    
    dispose();
  });

  bench('Alien - complex objects', () => {
    const objects = Array.from({ length: 50 }, (_, i) => 
      alienSignal(createComplexObject(i))
    );
    
    const aggregated = alienComputed(() => {
      return objects.reduce((sum, obj) => sum + obj().data.value, 0);
    });
    
    const dispose = alienEffect(() => void aggregated());
    
    // Update objects
    for (let i = 0; i < 100; i++) {
      const idx = i % objects.length;
      objects[idx]!(createComplexObject(idx + i));
    }
    
    dispose();
  });
});

describe('Wide Dependency Fan-out', () => {
  const FAN_OUT = 100;

  bench('Preact - wide fan-out', () => {
    const source = preactSignal(0);
    
    // Create many computeds depending on single source
    const computeds = Array.from({ length: FAN_OUT }, (_, i) => 
      preactComputed(() => source.value * (i + 1))
    );
    
    // Create effect depending on all computeds
    const dispose = preactEffect(() => {
      computeds.reduce((sum, c) => sum + c.value, 0);
    });
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      source.value = i;
    }
    
    dispose();
  });

  bench('Lattice - wide fan-out', () => {
    const source = latticeSignal(0);
    
    // Create many computeds depending on single source
    const computeds = Array.from({ length: FAN_OUT }, (_, i) => 
      latticeComputed(() => source.value * (i + 1))
    );
    
    // Create effect depending on all computeds
    const dispose = latticeEffect(() => {
      computeds.reduce((sum, c) => sum + c.value, 0);
    });
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      source.value = i;
    }
    
    dispose();
  });

  bench('Alien - wide fan-out', () => {
    const source = alienSignal(0);
    
    // Create many computeds depending on single source
    const computeds = Array.from({ length: FAN_OUT }, (_, i) => 
      alienComputed(() => source() * (i + 1))
    );
    
    // Create effect depending on all computeds
    const dispose = alienEffect(() => {
      computeds.reduce((sum, c) => sum + c(), 0);
    });
    
    // Trigger updates
    for (let i = 0; i < 100; i++) {
      source(i);
    }
    
    dispose();
  });
});
