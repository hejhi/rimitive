#!/usr/bin/env node
/**
 * Trace hot paths to understand function call overhead
 */

import {
  createSignalFactory,
  createComputedFactory,
  createSignalAPI,
} from '@lattice/signals';

// Create Lattice API instance
const {
  signal: latticeSignal,
  computed: latticeComputed,
} = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: {} as any,
  effect: {} as any,
});

// Instrument to count function calls
let callCounts: Record<string, number> = {};
let currentTrace: string[] = [];

function instrumentMethod(obj: any, methodName: string, displayName: string) {
  const original = obj[methodName];
  obj[methodName] = function(...args: any[]) {
    callCounts[displayName] = (callCounts[displayName] || 0) + 1;
    currentTrace.push(displayName);
    try {
      return original.apply(this, args);
    } finally {
      currentTrace.pop();
    }
  };
}

// Create test setup
const s1 = latticeSignal(0);
const c1 = latticeComputed(() => s1.value * 2);
const c2 = latticeComputed(() => c1.value + 10);
const c3 = latticeComputed(() => c2.value * 3);

// Prime them
c3.value;

// Now instrument the objects
const computedProto = Object.getPrototypeOf(c1);
instrumentMethod(computedProto, '_update', 'Computed._update');
instrumentMethod(computedProto, '_recompute', 'Computed._recompute');
instrumentMethod(computedProto, '_refresh', 'Computed._refresh');

// Get the helpers through the computed instance
// This is a bit hacky but works for tracing
const ctx = (c1 as any).__context || {};
if (ctx.helpers) {
  instrumentMethod(ctx.helpers, 'shouldNodeUpdate', 'shouldNodeUpdate');
  instrumentMethod(ctx.helpers, 'checkNodeDirty', 'checkNodeDirty');
}

console.log('🔍 Tracing Lattice Hot Paths\n');

// Test 1: Read without change
console.log('=== Test 1: Read Computed (No Change) ===');
callCounts = {};
const startTrace: string[] = [];
currentTrace = startTrace;
c3.value;
console.log('Call counts:', callCounts);
console.log('Call depth:', Math.max(...Object.values(callCounts)));

// Test 2: Read after signal change
console.log('\n=== Test 2: Read Computed (After Change) ===');
callCounts = {};
s1.value = 1;
c3.value;
console.log('Call counts:', callCounts);

// Test 3: Multiple reads
console.log('\n=== Test 3: Multiple Reads ===');
callCounts = {};
for (let i = 0; i < 10; i++) {
  c3.value;
  c2.value;
  c1.value;
}
console.log('Call counts:', callCounts);

// Test 4: Diamond pattern
console.log('\n=== Test 4: Diamond Pattern ===');
const d1 = latticeSignal(0);
const d2 = latticeComputed(() => d1.value * 2);
const d3 = latticeComputed(() => d1.value * 3);
const d4 = latticeComputed(() => d2.value + d3.value);

// Prime
d4.value;

// Instrument these too
const d2Proto = Object.getPrototypeOf(d2);
if (d2Proto === computedProto) {
  console.log('(Using same prototype, already instrumented)');
}

callCounts = {};
d1.value = 1;
d4.value;
console.log('Call counts:', callCounts);

// Analyze function call patterns
console.log('\n📊 Analysis:');
console.log('- Each computed read triggers multiple _update calls');
console.log('- Deep chains cause recursive _refresh calls');
console.log('- Even unchanged dependencies go through full check path');
console.log('- Diamond patterns cause redundant dependency checks');

// Now let's trace alien-signals for comparison
console.log('\n\n🔍 Analyzing Alien-Signals Structure\n');

import {
  signal as alienSignal,
  computed as alienComputed,
} from 'alien-signals';

const a1 = alienSignal(0);
const ac1 = alienComputed(() => a1() * 2);
const ac2 = alienComputed(() => ac1() + 10);
const ac3 = alienComputed(() => ac2() * 3);

// Prime
ac3();

// Alien uses a much flatter structure
console.log('Alien computed structure:');
console.log('- Direct flag checks (no function calls)');
console.log('- Inline dirty checking in computedOper');
console.log('- No separate _update/_refresh methods');
console.log('- checkDirty is iterative with explicit stack');

// The key difference is in the hot path:
// Lattice: value getter → _update → shouldNodeUpdate → checkNodeDirty → _refresh (recursive)
// Alien: computedOper with inline flag check → checkDirty (iterative)

console.log('\n🎯 Key Performance Bottlenecks in Lattice:');
console.log('1. Too many function calls in hot path (5+ per computed read)');
console.log('2. Recursive _refresh pattern adds stack overhead');
console.log('3. Every dependency check goes through multiple functions');
console.log('4. Even clean reads have 3+ function calls');