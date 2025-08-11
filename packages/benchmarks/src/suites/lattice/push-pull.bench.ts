/**
 * Push-Pull Optimization Benchmark
 * 
 * Tests the performance benefits of push-pull lazy evaluation in computed values.
 * Key scenarios:
 * 1. Intermediate computeds that filter out changes (avoiding unnecessary downstream computation)
 * 2. Conditional dependencies that may not always be evaluated
 * 3. Write-heavy patterns where reads are infrequent
 */

import { run, bench, group, barplot, summary } from 'mitata';

// Type for mitata benchmark state
interface BenchState {
  get(name: string): any;
}
import {
  signal as preactSignal,
  computed as preactComputed,
} from '@preact/signals-core';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
type LatticeExtension<N extends string, M> = { name: N; method: M };
import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

// Create Lattice API instance
const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const latticeSignal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const latticeComputed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

group('Filtered Updates', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - filter ratio: $filterRatio%', function* (state: BenchState) {
        const filterRatio = state.get('filterRatio');
        const iterations = 10000;
        const source = preactSignal(0);
        
        // Filter: only values divisible by filterRatio pass through
        const filtered = preactComputed(() => {
          const val = source.value;
          return val % (100 / filterRatio) === 0 ? val : -1;
        });
        const downstream = preactComputed(() => filtered.value * 2);
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source.value = i;
            void downstream.value;
          }
        };
      })
      .args('filterRatio', [10, 25, 50, 75]);
    
      bench('Lattice - filter ratio: $filterRatio%', function* (state: BenchState) {
        const filterRatio = state.get('filterRatio');
        const iterations = 10000;
        const source = latticeSignal(0);
        
        // Filter: only values divisible by filterRatio pass through
        const filtered = latticeComputed(() => {
          const val = source.value;
          return val % (100 / filterRatio) === 0 ? val : -1;
        });
        const downstream = latticeComputed(() => filtered.value * 2);
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source.value = i;
            void downstream.value;
          }
        };
      })
      .args('filterRatio', [10, 25, 50, 75]);
    
      bench('Alien - filter ratio: $filterRatio%', function* (state: BenchState) {
        const filterRatio = state.get('filterRatio');
        const iterations = 10000;
        const source = alienSignal(0);
        
        // Filter: only values divisible by filterRatio pass through
        const filtered = alienComputed(() => {
          const val = source();
          return val % (100 / filterRatio) === 0 ? val : -1;
        });
        const downstream = alienComputed(() => filtered() * 2);
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            source(i);
            void downstream();
          }
        };
      })
      .args('filterRatio', [10, 25, 50, 75]);
    });
  })
});

group('Conditional Dependencies', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - branch switching: $switchRatio%', function* (state: BenchState) {
        const switchRatio = state.get('switchRatio');
        const iterations = 10000;
        const selector = preactSignal(true);
        const branchA = preactSignal(0);
        const branchB = preactSignal(0);
        
        const result = preactComputed(() => 
          selector.value ? branchA.value : branchB.value
        );
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            // Switch branches based on ratio
            if (i % (100 / switchRatio) === 0) {
              selector.value = !selector.value;
            }
            // Always update both branches
            branchA.value = i;
            branchB.value = i * 2;
            void result.value;
          }
        };
      })
      .args('switchRatio', [0, 10, 50, 100]);
    
      bench('Lattice - branch switching: $switchRatio%', function* (state: BenchState) {
        const switchRatio = state.get('switchRatio');
        const iterations = 10000;
        const selector = latticeSignal(true);
        const branchA = latticeSignal(0);
        const branchB = latticeSignal(0);
        
        const result = latticeComputed(() => 
          selector.value ? branchA.value : branchB.value
        );
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            // Switch branches based on ratio
            if (switchRatio > 0 && i % (100 / switchRatio) === 0) {
              selector.value = !selector.value;
            }
            // Always update both branches
            branchA.value = i;
            branchB.value = i * 2;
            void result.value;
          }
        };
      })
      .args('switchRatio', [0, 10, 50, 100]);
    
      bench('Alien - branch switching: $switchRatio%', function* (state: BenchState) {
        const switchRatio = state.get('switchRatio');
        const iterations = 10000;
        const selector = alienSignal(true);
        const branchA = alienSignal(0);
        const branchB = alienSignal(0);
        
        const result = alienComputed(() => 
          selector() ? branchA() : branchB()
        );
        
        yield () => {
          for (let i = 0; i < iterations; i++) {
            // Switch branches based on ratio
            if (switchRatio > 0 && i % (100 / switchRatio) === 0) {
              selector(!selector());
            }
            // Always update both branches
            branchA(i);
            branchB(i * 2);
            void result();
          }
        };
      })
      .args('switchRatio', [0, 10, 50, 100]);
    });
  });
});

group('Write-Heavy Pattern', () => {
  summary(() => {
    barplot(() => {
      bench('Preact - $writeRatio writes per read', function* (state: BenchState) {
        const writeRatio = state.get('writeRatio');
        const totalOps = 10000;
        const source = preactSignal(0);
        const c1 = preactComputed(() => source.value * 2);
        const c2 = preactComputed(() => c1.value * 2);
        const c3 = preactComputed(() => c2.value * 2);
        
        yield () => {
          let writeCount = 0;
          for (let i = 0; i < totalOps; i++) {
            source.value = i;
            writeCount++;
            
            // Read based on ratio
            if (writeCount >= writeRatio) {
              void c3.value;
              writeCount = 0;
            }
          }
        };
      })
      .args('writeRatio', [1, 10, 100, 1000]);
    
      bench('Lattice - $writeRatio writes per read', function* (state: BenchState) {
        const writeRatio = state.get('writeRatio');
        const totalOps = 10000;
        const source = latticeSignal(0);
        const c1 = latticeComputed(() => source.value * 2);
        const c2 = latticeComputed(() => c1.value * 2);
        const c3 = latticeComputed(() => c2.value * 2);
        
        yield () => {
          let writeCount = 0;
          for (let i = 0; i < totalOps; i++) {
            source.value = i;
            writeCount++;
            
            // Read based on ratio
            if (writeCount >= writeRatio) {
              void c3.value;
              writeCount = 0;
            }
          }
        };
      })
      .args('writeRatio', [1, 10, 100, 1000]);
    
      bench('Alien - $writeRatio writes per read', function* (state: BenchState) {
        const writeRatio = state.get('writeRatio');
        const totalOps = 10000;
        const source = alienSignal(0);
        const c1 = alienComputed(() => source() * 2);
        const c2 = alienComputed(() => c1() * 2);
        const c3 = alienComputed(() => c2() * 2);
        
        yield () => {
          let writeCount = 0;
          for (let i = 0; i < totalOps; i++) {
            source(i);
            writeCount++;
            
            // Read based on ratio
            if (writeCount >= writeRatio) {
              void c3();
              writeCount = 0;
            }
          }
        };
      })
      .args('writeRatio', [1, 10, 100, 1000]);
    });
  });
});

// Run all benchmarks
await run();