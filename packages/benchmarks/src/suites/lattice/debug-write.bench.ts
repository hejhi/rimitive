/**
 * Debug Write Benchmark
 * 
 * Tests to understand why the early return optimization didn't work
 */

import { bench, group } from 'mitata';
import { runBenchmark } from '../../utils/benchmark-runner';
import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';

runBenchmark('debug-write', () => {
  
  group('Debug Signal Writes', () => {
    bench('Write with NO subscribers - verify _out is null', function* () {
      const ctx = createDefaultContext();
      const { signal } = createSignalAPI(ctx);
      const source = signal(0);
      
      // Check if _out is null
      const hasOut = (source as any)._out !== null && (source as any)._out !== undefined;
      if (hasOut) {
        throw new Error(`Expected _out to be null but got: ${(source as any)._out}`);
      }
      
      yield () => {
        for (let i = 0; i < 100000; i++) {
          source.value = i;
        }
      };
    });

    bench('Write with 1 effect subscriber', function* () {
      const ctx = createDefaultContext();
      const { signal, effect } = createSignalAPI(ctx);
      const source = signal(0);
      
      // Add one effect subscriber
      const dispose = effect(() => { source.value; });
      
      // Check if _out is NOT null
      const hasOut = (source as any)._out !== null && (source as any)._out !== undefined;
      if (!hasOut) {
        throw new Error('Expected _out to be non-null with subscriber');
      }
      
      yield () => {
        for (let i = 0; i < 100000; i++) {
          source.value = i;
        }
      };
      
      dispose();
    });

    bench('Write then dispose subscriber - verify _out becomes null', function* () {
      const ctx = createDefaultContext();
      const { signal, effect } = createSignalAPI(ctx);
      const source = signal(0);
      
      // Add then remove subscriber
      const dispose = effect(() => { source.value; });
      dispose();
      
      // Check if _out is null after disposal
      const hasOut = (source as any)._out !== null && (source as any)._out !== undefined;
      if (hasOut) {
        throw new Error(`Expected _out to be null after disposal but got: ${(source as any)._out}`);
      }
      
      yield () => {
        for (let i = 0; i < 100000; i++) {
          source.value = i;
        }
      };
    });
  });
});