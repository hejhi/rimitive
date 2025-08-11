/**
 * Advanced Pattern Benchmarks
 * 
 * Tests scenarios from alien-signals benchmarks that aren't covered
 * in our standard comparison suite:
 * 1. Grid propagation patterns
 * 2. Complex object updates
 * 3. Deep propagation chains
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

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

boxplot(() => {
  group('Grid Propagation Pattern', () => {
    bench('Preact - grid: $w × $h', function* (state: BenchState) {
      const w = state.get('w');
      const h = state.get('h');
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
      
      yield () => {
        src.value++;
      };
      
      // Cleanup
      effects.forEach(dispose => dispose());
    })
    .args('w', [1, 10, 50])
    .args('h', [1, 10, 50]);

    bench('Lattice - grid: $w × $h', function* (state: BenchState) {
      const w = state.get('w');
      const h = state.get('h');
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
      
      yield () => {
        src.value++;
      };
      
      // Cleanup
      effects.forEach(dispose => dispose());
    })
    .args('w', [1, 10, 50])
    .args('h', [1, 10, 50]);

    bench('Alien - grid: $w × $h', function* (state: BenchState) {
      const w = state.get('w');
      const h = state.get('h');
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
      
      yield () => {
        src(src() + 1);
      };
      
      // Cleanup
      effects.forEach(dispose => dispose());
    })
    .args('w', [1, 10, 50])
    .args('h', [1, 10, 50]);
  });
});

boxplot(() => {
  group('Deep Chain Propagation', () => {
    bench('Preact - chain depth: $depth', function* (state: BenchState) {
      const depth = state.get('depth');
      const src = preactSignal(0);
      let last = src;
      
      // Create deep chain
      for (let i = 0; i < depth; i++) {
        const prev = last;
        last = preactComputed(() => prev.value + 1);
      }
      
      const dispose = preactEffect(() => void last.value);
      
      yield () => {
        src.value++;
      };
      
      dispose();
    })
    .args('depth', [10, 50, 100, 200]);

    bench('Lattice - chain depth: $depth', function* (state: BenchState) {
      const depth = state.get('depth');
      const src = latticeSignal(0);
      let last: { value: number } = src;
      
      // Create deep chain
      for (let i = 0; i < depth; i++) {
        const prev = last;
        last = latticeComputed(() => prev.value + 1);
      }
      
      const dispose = latticeEffect(() => void last.value);
      
      yield () => {
        src.value++;
      };
      
      dispose();
    })
    .args('depth', [10, 50, 100, 200]);

    bench('Alien - chain depth: $depth', function* (state: BenchState) {
      const depth = state.get('depth');
      const src = alienSignal(0);
      let last = src;
      
      // Create deep chain
      for (let i = 0; i < depth; i++) {
        const prev = last;
        last = alienComputed(() => prev() + 1);
      }
      
      const dispose = alienEffect(() => void last());
      
      yield () => {
        src(src() + 1);
      };
      
      dispose();
    })
    .args('depth', [10, 50, 100, 200]);
  });
});

boxplot(() => {
  group('Complex Object Updates', () => {
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

    bench('Preact - objects: $count', function* (state: BenchState) {
      const count = state.get('count');
      const objects = Array.from({ length: count }, (_, i) => 
        preactSignal(createComplexObject(i))
      );
      
      const aggregated = preactComputed(() => {
        return objects.reduce((sum, obj) => sum + obj.value.data.value, 0);
      });
      
      const dispose = preactEffect(() => void aggregated.value);
      
      let updateIdx = 0;
      yield () => {
        const idx = updateIdx % objects.length;
        objects[idx]!.value = createComplexObject(idx + updateIdx);
        updateIdx++;
      };
      
      dispose();
    })
    .args('count', [10, 50, 100]);

    bench('Lattice - objects: $count', function* (state: BenchState) {
      const count = state.get('count');
      const objects = Array.from({ length: count }, (_, i) => 
        latticeSignal(createComplexObject(i))
      );
      
      const aggregated = latticeComputed(() => {
        return objects.reduce((sum, obj) => sum + obj.value.data.value, 0);
      });
      
      const dispose = latticeEffect(() => void aggregated.value);
      
      let updateIdx = 0;
      yield () => {
        const idx = updateIdx % objects.length;
        objects[idx]!.value = createComplexObject(idx + updateIdx);
        updateIdx++;
      };
      
      dispose();
    })
    .args('count', [10, 50, 100]);

    bench('Alien - objects: $count', function* (state: BenchState) {
      const count = state.get('count');
      const objects = Array.from({ length: count }, (_, i) => 
        alienSignal(createComplexObject(i))
      );
      
      const aggregated = alienComputed(() => {
        return objects.reduce((sum, obj) => sum + obj().data.value, 0);
      });
      
      const dispose = alienEffect(() => void aggregated());
      
      let updateIdx = 0;
      yield () => {
        const idx = updateIdx % objects.length;
        objects[idx]!(createComplexObject(idx + updateIdx));
        updateIdx++;
      };
      
      dispose();
    })
    .args('count', [10, 50, 100]);
  });
});

boxplot(() => {
  group('Wide Dependency Fan-out', () => {
    bench('Preact - fan-out: $width', function* (state: BenchState) {
      const width = state.get('width');
      const source = preactSignal(0);
      
      // Create many computeds depending on single source
      const computeds = Array.from({ length: width }, (_, i) => 
        preactComputed(() => source.value * (i + 1))
      );
      
      // Create effect depending on all computeds
      const dispose = preactEffect(() => {
        computeds.reduce((sum, c) => sum + c.value, 0);
      });
      
      yield () => {
        source.value++;
      };
      
      dispose();
    })
    .args('width', [10, 50, 100, 200]);

    bench('Lattice - fan-out: $width', function* (state: BenchState) {
      const width = state.get('width');
      const source = latticeSignal(0);
      
      // Create many computeds depending on single source
      const computeds = Array.from({ length: width }, (_, i) => 
        latticeComputed(() => source.value * (i + 1))
      );
      
      // Create effect depending on all computeds
      const dispose = latticeEffect(() => {
        computeds.reduce((sum, c) => sum + c.value, 0);
      });
      
      yield () => {
        source.value++;
      };
      
      dispose();
    })
    .args('width', [10, 50, 100, 200]);

    bench('Alien - fan-out: $width', function* (state: BenchState) {
      const width = state.get('width');
      const source = alienSignal(0);
      
      // Create many computeds depending on single source
      const computeds = Array.from({ length: width }, (_, i) => 
        alienComputed(() => source() * (i + 1))
      );
      
      // Create effect depending on all computeds
      const dispose = alienEffect(() => {
        computeds.reduce((sum, c) => sum + c(), 0);
      });
      
      yield () => {
        source(source() + 1);
      };
      
      dispose();
    })
    .args('width', [10, 50, 100, 200]);
  });
});

// Run all benchmarks with markdown output for better visualization
await run({ format: 'markdown' });
