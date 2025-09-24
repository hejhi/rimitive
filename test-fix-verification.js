// Direct test of the fix in the built distribution
import { createApi } from './packages/benchmarks/src/suites/lattice/helpers/signal-computed.js';

const api = createApi();
const { signal, computed } = api;

// Create diamond pattern
const source = signal(0);
const left = computed(() => source() * 2);
const right = computed(() => source() * 3);
const bottom = computed(() => left() + right());

// Initial evaluation
bottom();

// Count initial dependencies
let depCount = 0;
let dep = bottom.dependencies;
while (dep) {
  depCount++;
  dep = dep.nextDependency;
}
console.log('Initial dependencies on bottom:', depCount);

// Track dependency creation by instrumenting trackDependency
let newDepsCreated = 0;
const originalTrackDep = api._internal?.trackDependency || Object.getOwnPropertySymbols(api).map(s => api[s]).find(v => v?.trackDependency)?.trackDependency;

if (!originalTrackDep) {
  // Try to access through the computed node's internal structure
  const computedNode = Object.getOwnPropertySymbols(bottom).map(s => bottom[s]).find(v => v?.dependencies !== undefined) || bottom;

  console.log('\nRunning 1000 iterations...');
  for (let i = 1; i <= 1000; i++) {
    source(i);
    bottom();
  }

  // Count dependencies after iterations
  depCount = 0;
  dep = computedNode.dependencies;
  while (dep) {
    depCount++;
    dep = dep.nextDependency;
  }
  console.log('Dependencies after 1000 iterations:', depCount);

  if (depCount > 2) {
    console.log('❌ MEMORY LEAK STILL PRESENT - Dependencies accumulated!');
  } else {
    console.log('✅ FIX VERIFIED - No dependency accumulation!');
  }
} else {
  console.log('Could not instrument trackDependency, running basic test...');
}