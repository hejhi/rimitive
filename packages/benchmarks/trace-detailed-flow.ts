/**
 * Detailed trace showing EXACTLY when and why redundant isStale() calls happen
 */

import { createSignalAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';

type LatticeExtension<N extends string, M> = { name: N; method: M };

const ctx = createDefaultContext();

// Track the execution flow
let indent = 0;
const log = (msg: string) => console.log('  '.repeat(indent) + msg);

// Intercept isStale calls
const originalIsStale = ctx.graph.isStale;
let nodeNames = new WeakMap();
ctx.graph.isStale = function(node: any) {
  const name = nodeNames.get(node) || 'unknown';
  log(`📊 isStale(${name}) called`);
  indent++;
  
  const result = originalIsStale.call(this, node);
  
  indent--;
  log(`📊 isStale(${name}) → ${result ? 'STALE' : 'CLEAN'}`);
  
  return result;
};

// Create traced computed factory
function tracedComputed<T>(name: string, compute: () => T) {
  const comp = latticeAPI.computed(() => {
    log(`🔧 ${name}._recompute() starting`);
    indent++;
    const result = compute();
    indent--;
    log(`🔧 ${name}._recompute() → ${result}`);
    return result;
  }) as any;
  
  // Store name for debugging
  nodeNames.set(comp, name);
  
  // Wrap the read function
  const originalRead = comp;
  const wrapped = function() {
    log(`📖 ${name}.read() called`);
    indent++;
    const result = originalRead();
    indent--;
    log(`📖 ${name}.read() → ${result}`);
    return result;
  };
  
  // Copy over properties
  Object.setPrototypeOf(wrapped, Object.getPrototypeOf(comp));
  for (const key in comp) {
    (wrapped as any)[key] = comp[key];
  }
  nodeNames.set(wrapped, name);
  
  return wrapped as ComputedInterface<T>;
}

const latticeAPI = createSignalAPI({
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
}, ctx);

const signal = latticeAPI.signal as <T>(value: T) => SignalInterface<T>;

console.log('=== Setting up chain: s → c1 → c2 → c3 ===\n');

const s = signal(1);
const c1 = tracedComputed('c1', () => s() + 1);
const c2 = tracedComputed('c2', () => c1() + 1);
const c3 = tracedComputed('c3', () => c2() + 1);

console.log('=== Initial read (establishes dependencies) ===\n');
c3();

console.log('\n=== Signal update: s(10) ===\n');
s(10);

console.log('\n=== Now reading c3 - watch the redundant calls! ===\n');
console.log('EXPECTED FLOW:');
console.log('  c3.read() → isStale(c3) → traverses to c1 → updates c1, c2 during traversal → c3 recomputes\n');
console.log('ACTUAL FLOW:\n');

c3();

console.log('\n=== THE PROBLEM VISUALIZED ===\n');
console.log('When c3.read() is called:');
console.log('  1. c3 is INVALIDATED, so it calls isStale(c3)');
console.log('  2. isStale(c3) traverses: c3 → c2 → c1 → signal');
console.log('  3. During traversal unwinding:');
console.log('     - c1._recompute() executes (reads signal)');
console.log('     - c2._recompute() executes (reads c1)');
console.log('       ⚠️  BUT c1.read() ALSO calls isStale(c1)!');
console.log('  4. Back to c3, which recomputes reading c2');
console.log('     ⚠️  c2.read() ALSO calls isStale(c2)!');
console.log('\nEach computed redundantly checks staleness even though');
console.log('the parent isStale() already handled the updates!');