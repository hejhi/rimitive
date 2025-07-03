// Hidden class profiling for Lattice signals
// Run with: node --trace-maps --trace-deopt --trace-ic --allow-natives-syntax profile-v8.cjs

const { createSignalFactory } = require('./dist/primitives/signals/lattice-integration.js');

// Test 1: Check scope object stability
function testScopeStability() {
  const factories = [];
  for (let i = 0; i < 100; i++) {
    factories.push(createSignalFactory());
  }
  
  console.log('\n=== Scope Hidden Class Stability ===');
  try {
    console.log('Factory 0 vs 1:', %HaveSameMap(factories[0], factories[1]));
    console.log('Factory 0 vs 50:', %HaveSameMap(factories[0], factories[50]));
    console.log('Factory 0 vs 99:', %HaveSameMap(factories[0], factories[99]));
  } catch (e) {
    console.log('Native syntax not enabled');
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
  
  console.log('\n=== Signal Hidden Class Stability ===');
  try {
    console.log('Signal 0 vs 1:', %HaveSameMap(signals[0], signals[1]));
    console.log('Signal 0 vs 50:', %HaveSameMap(signals[0], signals[50]));
    console.log('Signal 0 vs 99:', %HaveSameMap(signals[0], signals[99]));
  } catch (e) {
    console.log('Native syntax not enabled');
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
  
  console.log('\n=== Computed Hidden Class Stability ===');
  try {
    console.log('Computed 0 vs 1:', %HaveSameMap(computeds[0], computeds[1]));
    console.log('Computed 0 vs 50:', %HaveSameMap(computeds[0], computeds[50]));
    console.log('Computed 0 vs 99:', %HaveSameMap(computeds[0], computeds[99]));
  } catch (e) {
    console.log('Native syntax not enabled');
  }
  
  return computeds;
}

// Test 4: Hot path performance
function benchmarkHotPath() {
  const { signal, computed } = createSignalFactory();
  
  console.log('\n=== Hot Path Benchmark ===');
  
  const count = signal(0);
  const doubled = computed(() => count() * 2);
  const quadrupled = computed(() => doubled() * 2);
  
  // Warm up
  for (let i = 0; i < 10000; i++) {
    count(i);
    quadrupled();
  }
  
  // Actual benchmark
  console.time('1M updates');
  for (let i = 0; i < 1000000; i++) {
    count(i);
    quadrupled();
  }
  console.timeEnd('1M updates');
}

// Test 5: Memory and shape patterns
function analyzeMemoryPatterns() {
  console.log('\n=== Memory Pattern Analysis ===');
  
  const { signal, computed } = createSignalFactory();
  const iterations = 10000;
  
  // Pattern 1: Create many signals
  console.time('Create 10k signals');
  const signals = [];
  for (let i = 0; i < iterations; i++) {
    signals.push(signal(i));
  }
  console.timeEnd('Create 10k signals');
  
  // Pattern 2: Create many computeds
  console.time('Create 10k computeds');
  const computeds = [];
  const base = signal(0);
  for (let i = 0; i < iterations; i++) {
    computeds.push(computed(() => base() + i));
  }
  console.timeEnd('Create 10k computeds');
  
  // Pattern 3: Update propagation
  console.time('10k update propagations');
  for (let i = 0; i < iterations; i++) {
    base(i);
  }
  console.timeEnd('10k update propagations');
}

// Run all tests
console.log('Starting V8 Hidden Class Profiling...\n');

testScopeStability();
testSignalShapes();
testComputedShapes();
benchmarkHotPath();
analyzeMemoryPatterns();

console.log('\n=== Profiling Complete ===');