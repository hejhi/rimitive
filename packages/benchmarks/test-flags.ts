/**
 * Check the flags on computeds after signal update
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

const ctx = createDefaultContext();

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, ctx);

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const computed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

// Create chain
const s = signal(1);
const c1 = computed(() => s() + 1);
const c2 = computed(() => c1() + 1);
const c3 = computed(() => c2() + 1);

// Initial read
console.log('Initial values:', c3());

// Check flags after signal update
console.log('\n=== After s(10) ===');
s(10);

// Access internal state (for debugging)
const getFlags = (c: any) => {
  // The computed function has the state in closure
  // We need to access it through the internal properties
  return c._flags || 'unknown';
};

console.log('c1 flags:', getFlags(c1));
console.log('c2 flags:', getFlags(c2));
console.log('c3 flags:', getFlags(c3));

const INVALIDATED = 1 << 1;
const DIRTY = 1 << 2;

console.log('\nFlag meanings:');
console.log('INVALIDATED (2):', INVALIDATED);
console.log('DIRTY (4):', DIRTY);

console.log('\n=== Now reading c3 ===');
const result = c3();
console.log('Result:', result);