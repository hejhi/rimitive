import { createApi } from './src/suites/lattice/helpers/signal-computed-effect';

// Create ONE API instance (as benchmarks do)
const api = createApi();

// Create multiple sets of nodes (simulating what happens in yield)
const nodeSet1 = {
  signal: api.signal(0),
  computed: api.computed(() => 1),
  effect: api.effect(() => {}),
};

const nodeSet2 = {
  signal: api.signal(10),
  computed: api.computed(() => 2),
  effect: api.effect(() => {}),
};

console.log('🔍 Investigating shared state:');
console.log('\n1. API Context:');
console.log(`   Context object identity: ${api._ctx}`);
console.log(`   Is same context: true (only one API instance)`);

console.log('\n2. What this means:');
console.log('   - All nodes share the SAME GlobalContext');
console.log('   - All nodes share the SAME graph edge helpers');
console.log('   - All nodes share the SAME scheduler');
console.log('   - All nodes share the SAME propagation functions');

console.log('\n3. The accumulation mechanism:');
console.log('   When nodeSet2.computed reads nodeSet1.signal:');
console.log('   - It uses the SHARED trackDependency function');
console.log('   - Creates an edge in the SHARED graph');
console.log('   - Both nodes remain in memory (referenced by graph edges)');

console.log('\n4. Why Preact/Alien don\'t have this issue:');
console.log('   - They use GLOBAL variables (evalContext, activeSub)');
console.log('   - No instance-based context or helpers');
console.log('   - Nodes don\'t accumulate through shared instances');

console.log('\n5. In benchmarks:');
console.log('   - mitata creates the generator ONCE');
console.log('   - But calls the yield function THOUSANDS of times');
console.log('   - Each yield call creates NEW nodes');
console.log('   - All nodes share the SAME API/context/helpers');
console.log('   - Result: All nodes accumulate in the graph!');

// Demonstrate the issue
console.log('\n🔴 DEMONSTRATION:');

// Create a computed that depends on a signal from a different "iteration"
const crossReference = api.computed(() => {
  // This computed can read signals from ANY previous iteration
  return nodeSet1.signal() + nodeSet2.signal();
});

console.log('Created a computed that reads from both node sets');
console.log('Value:', crossReference());
console.log('This computed now holds references to BOTH signal nodes');
console.log('preventing them from being garbage collected!');