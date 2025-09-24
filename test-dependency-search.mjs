// Test to verify the exhaustive search is actually happening
import { createGraphEdges } from './packages/signals/dist/helpers/graph-edges.js';

const graphEdges = createGraphEdges();
const { trackDependency } = graphEdges;

// Create mock nodes
const producer1 = { subscribers: null, subscribersTail: null };
const producer2 = { subscribers: null, subscribersTail: null };
const producer3 = { subscribers: null, subscribersTail: null };
const consumer = { dependencies: null, dependencyTail: null };

console.log('Testing exhaustive dependency search...\n');

// Track dependencies in specific order
console.log('1. Track producer1 -> consumer');
trackDependency(producer1, consumer);

console.log('2. Track producer2 -> consumer');
trackDependency(producer2, consumer);

console.log('3. Track producer3 -> consumer');
trackDependency(producer3, consumer);

// Count dependencies
let count = 0;
let dep = consumer.dependencies;
while (dep) {
  count++;
  dep = dep.nextDependency;
}
console.log(`\nConsumer has ${count} dependencies`);

// Now re-track producer1 (should reuse, not create new)
console.log('\n4. Re-track producer1 -> consumer (should reuse)');
trackDependency(producer1, consumer);

// Count again
count = 0;
dep = consumer.dependencies;
while (dep) {
  count++;
  dep = dep.nextDependency;
}
console.log(`Consumer still has ${count} dependencies (should be 3, not 4)`);

// Test the problematic case: track out of sequence
console.log('\n5. Track producer2 again (middle of list)');
trackDependency(producer2, consumer);

count = 0;
dep = consumer.dependencies;
while (dep) {
  count++;
  dep = dep.nextDependency;
}
console.log(`Consumer still has ${count} dependencies (should be 3, not 4)`);

if (count === 3) {
  console.log('\n✅ Exhaustive search is working - dependencies are being reused!');
} else {
  console.log('\n❌ Problem - dependencies are being duplicated!');
}