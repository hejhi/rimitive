/**
 * Effect Trigger Benchmarks
 * 
 * Tests how efficiently effects are triggered on signal changes
 */

import { run, bench, group, summary, barplot } from 'mitata';
import {
  signal as preactSignal,
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
  effect as alienEffect,
} from 'alien-signals';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeEffect = latticeAPI.effect as (fn: () => void | (() => void)) => EffectDisposer;

const ITERATIONS = 10000;

group('Single Effect', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signal = preactSignal(0);
        let counter = 0;
        const dispose = preactEffect(() => {
          counter += signal.value;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Lattice', function* () {
        const signal = latticeSignal(0);
        let counter = 0;
        const dispose = latticeEffect(() => {
          counter += signal.value;
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal.value = i;
          }
        };
        
        dispose();
      });
    
      bench('Alien', function* () {
        const signal = alienSignal(0);
        let counter = 0;
        const dispose = alienEffect(() => {
          counter += signal();
        });
        
        yield () => {
          for (let i = 0; i < ITERATIONS; i++) {
            signal(i);
          }
        };
        
        dispose();
      });
    });
  });
});

group('Multiple Effects', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - 10 effects', function* () {
        const signal = preactSignal(0);
        let counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          preactEffect(() => {
            counters[i] += signal.value;
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal.value = i;
          }
        };
        
        disposers.forEach(d => d());
      });
    
      bench('Lattice - 10 effects', function* () {
        const signal = latticeSignal(0);
        let counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          latticeEffect(() => {
            counters[i] += signal.value;
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal.value = i;
          }
        };
        
        disposers.forEach(d => d());
      });
    
      bench('Alien - 10 effects', function* () {
        const signal = alienSignal(0);
        let counters = Array(10).fill(0);
        const disposers = counters.map((_, i) => 
          alienEffect(() => {
            counters[i] += signal();
          })
        );
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 10; i++) {
            signal(i);
          }
        };
        
        disposers.forEach(d => d());
      });
    });
  });
});

group('Effect Cleanup', () => {
  summary(() => {
    barplot(() => {
      bench('Preact', function* () {
        const signal = preactSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = preactEffect(() => {
              void signal.value;
            });
            signal.value = i;
            dispose();
          }
        };
      });
    
      bench('Lattice', function* () {
        const signal = latticeSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = latticeEffect(() => {
              void signal.value;
            });
            signal.value = i;
            dispose();
          }
        };
      });
    
      bench('Alien', function* () {
        const signal = alienSignal(0);
        
        yield () => {
          for (let i = 0; i < ITERATIONS / 100; i++) {
            const dispose = alienEffect(() => {
              void signal();
            });
            signal(i);
            dispose();
          }
        };
      });
    });
  });
});

// Run benchmarks
const format = process.env.BENCHMARK_FORMAT === 'json' 
  ? { json: { debug: false, samples: false } }
  : undefined;

const results = await run({ format });

if (process.env.BENCHMARK_FORMAT === 'json') {
  console.log(JSON.stringify(results, null, 2));
}