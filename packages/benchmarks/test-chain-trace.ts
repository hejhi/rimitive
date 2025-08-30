import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as any,
  computed: createComputedFactory as any,
}, createDefaultContext());

const signal = latticeAPI.signal;
const computed = latticeAPI.computed;

// Create a deep chain
const source = signal(0);
const c1 = computed(() => {
  console.log('c1 recomputing');
  return source() + 1;
});
const c2 = computed(() => {
  console.log('c2 recomputing');
  return c1() + 1;
});
const c3 = computed(() => {
  console.log('c3 recomputing');
  return c2() + 1;
});

console.log('Initial read:');
console.log('c3 =', c3());

console.log('\nUpdate source to 1:');
source(1);

console.log('\nRead c3 after update:');
console.log('c3 =', c3());