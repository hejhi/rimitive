// Simple profiling script
import { createComponent } from './dist/index.js';

console.log('=== Lattice V8 Performance Profile ===\n');

// Test 1: Basic performance
console.log('1. Basic Signal Performance:');
const store = createComponent({ count: 0, name: 'test' });
const { set, computed } = store;

// Create computed
const doubled = computed(() => store.store.count() * 2);

console.time('100k signal updates');
for (let i = 0; i < 100000; i++) {
  set(store.store.count, i);
}
console.timeEnd('100k signal updates');

console.time('100k computed reads');
for (let i = 0; i < 100000; i++) {
  doubled();
}
console.timeEnd('100k computed reads');

// Test 2: Complex dependency graph
console.log('\n2. Complex Dependency Graph:');
const complexStore = createComponent({ 
  a: 1, b: 2, c: 3, d: 4, e: 5 
});

const comp1 = computed(() => complexStore.store.a() + complexStore.store.b());
const comp2 = computed(() => complexStore.store.c() + complexStore.store.d());
const comp3 = computed(() => comp1() + comp2());
const comp4 = computed(() => comp3() * complexStore.store.e());

console.time('10k complex updates');
for (let i = 0; i < 10000; i++) {
  set(complexStore.store.a, i);
  comp4(); // Force evaluation
}
console.timeEnd('10k complex updates');

// Test 3: Memory pressure
console.log('\n3. Memory Pressure Test:');
const signals = [];
console.time('Create 10k components');
for (let i = 0; i < 10000; i++) {
  signals.push(createComponent({ value: i }));
}
console.timeEnd('Create 10k components');

// Test 4: Batch updates
console.log('\n4. Batch Update Performance:');
const batchStore = createComponent({ 
  items: Array(100).fill(0).map((_, i) => i) 
});

console.time('1k batch updates');
for (let i = 0; i < 1000; i++) {
  // Update entire array
  set(batchStore.store.items, prev => prev.map(v => v + 1));
}
console.timeEnd('1k batch updates');

console.log('\n=== Profile Complete ===');