import { createSignalFactory } from './src/signal';
import { createEffectFactory } from './src/effect';
import { createContext } from '../lattice/src/factory';

// Create context with factories
const ctx = createContext([
  createSignalFactory,
  createEffectFactory,
]);

const { signal, effect } = ctx;

// Test 1: Signal with no subscribers
const source1 = signal(0);
console.log('Signal with no subscribers:');
console.log('  _out is null?', (source1 as any)._out === null);
console.log('  _out is undefined?', (source1 as any)._out === undefined);
console.log('  _out value:', (source1 as any)._out);

// Test 2: Signal with one effect subscriber
const source2 = signal(0);
const dispose = effect(() => { source2.value; });
console.log('\nSignal with effect subscriber:');
console.log('  _out is null?', (source2 as any)._out === null);
console.log('  _out is undefined?', (source2 as any)._out === undefined);
console.log('  _out value:', (source2 as any)._out);

// Test 3: Signal after disposing subscriber
dispose();
console.log('\nSignal after disposing subscriber:');
console.log('  _out is null?', (source2 as any)._out === null);
console.log('  _out is undefined?', (source2 as any)._out === undefined);
console.log('  _out value:', (source2 as any)._out);