import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, createDefaultContext());

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;
const computed = latticeAPI.computed as <T>(compute: () => T) => ComputedInterface<T>;

const s = signal(0);
let last: (() => number) = s;

// Create 50 deep chain
for (let i = 0; i < 50; i++) {
  const prev = last;
  last = computed(() => prev() + 1);
}

// Establish dependencies
console.log('Initial read:', last());

// Update
s(10);
console.log('After update:', last());