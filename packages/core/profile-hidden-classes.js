// Hidden class profiling for Lattice signals
// Run with: node --trace-maps --trace-deopt --trace-ic --allow-natives-syntax profile-hidden-classes.js

import { createSignalFactory } from './dist/primitives/signals/lattice-integration.js';

// Test 1: Check scope object stability
function testScopeStability() {
  const factories = [];
  for (let i = 0; i < 100; i++) {
    factories.push(createSignalFactory());
  }
  
  if (typeof %HaveSameMap !== 'undefined') {
    console.log('\n=== Scope Hidden Class Stability ===');
    console.log('Factory 0 vs 1:', %HaveSameMap(factories[0], factories[1]));
    console.log('Factory 0 vs 50:', %HaveSameMap(factories[0], factories[50]));
    console.log('Factory 0 vs 99:', %HaveSameMap(factories[0], factories[99]));
  }
  
  return factories;
}

// Test 2: Signal creation and property access
function testSignalShapes() {
  const { signal } = createSignalFactory();
  
  const signals = [];
  for (let i = 0; i < 100; i++) {
    signals.push(signal(i));
  }
  
  if (typeof %HaveSameMap !== 'undefined') {
    console.log('\n=== Signal Hidden Class Stability ===');
    console.log('Signal 0 vs 1:', %HaveSameMap(signals[0], signals[1]));
    console.log('Signal 0 vs 50:', %HaveSameMap(signals[0], signals[50]));
    console.log('Signal 0 vs 99:', %HaveSameMap(signals[0], signals[99]));
  }
  
  return signals;
}

// Test 3: Computed shapes
function testComputedShapes() {
  const { signal, computed } = createSignalFactory();
  
  const s = signal(0);
  const computeds = [];
  
  for (let i = 0; i < 100; i++) {
    computeds.push(computed(() => s() + i));
  }
  
  if (typeof %HaveSameMap !== 'undefined') {
    console.log('\n=== Computed Hidden Class Stability ===');
    console.log('Computed 0 vs 1:', %HaveSameMap(computeds[0], computeds[1]));
    console.log('Computed 0 vs 50:', %HaveSameMap(computeds[0], computeds[50]));
    console.log('Computed 0 vs 99:', %HaveSameMap(computeds[0], computeds[99]));
  }
  
  return computeds;
}

// Test 4: Hot path performance with shape transitions
function benchmarkHotPath() {
  const { signal, computed } = createSignalFactory();
  
  console.log('\n=== Hot Path Benchmark ===');
  
  // Create typical reactive graph
  const count = signal(0);
  const doubled = computed(() => count() * 2);
  const quadrupled = computed(() => doubled() * 2);
  
  // Warm up to trigger optimization
  for (let i = 0; i < 10000; i++) {
    count(i);
    quadrupled();
  }
  
  if (typeof %GetOptimizationStatus !== 'undefined') {
    // Check optimization status of hot functions
    console.log('Signal read optimized?', %GetOptimizationStatus(count));
    console.log('Computed read optimized?', %GetOptimizationStatus(doubled));
  }
  
  // Actual benchmark
  console.time('1M updates');
  for (let i = 0; i < 1000000; i++) {
    count(i);
    quadrupled();
  }
  console.timeEnd('1M updates');
}

// Test 5: Check for deoptimization triggers
function testDeoptimizationPatterns() {
  const { signal, computed, effect } = createSignalFactory();
  
  console.log('\n=== Testing Deoptimization Patterns ===');
  
  // Pattern 1: Consistent property access
  const s1 = signal({ x: 1, y: 2 });
  const s2 = signal({ x: 3, y: 4 });
  
  if (typeof %HaveSameMap !== 'undefined') {
    console.log('Object signals same shape?', %HaveSameMap(s1(), s2()));
  }
  
  // Pattern 2: Dynamic property addition (BAD)
  const obj = { x: 1 };
  const s3 = signal(obj);
  obj.y = 2; // This changes the hidden class
  
  // Pattern 3: Mixed types (potential polymorphism)
  const mixed = signal(1);
  mixed('string'); // Type change
  mixed(null); // Another type
  mixed(1); // Back to number
  
  console.log('Check console output for deoptimization warnings');
}

// Run all tests
console.log('Starting V8 Hidden Class Profiling...\n');

testScopeStability();
testSignalShapes();
testComputedShapes();
benchmarkHotPath();
testDeoptimizationPatterns();

console.log('\n=== Profiling Complete ===');
console.log('Look for [TraceMaps] and [Deopt] messages above');