const { createStore, computed } = require('./packages/core/dist/index.js');

console.log('Testing signals directly...');

// Replicate the exact test scenario
const createSlice = createStore({
  count: 0,
  name: 'test',
  items: [],
});

const counterSlice = createSlice(({ count }) => ({
  value: count, // count is already a signal
  increment: () => count(count() + 1),
  isEven: computed(() => count() % 2 === 0),
}));

const slice = counterSlice();

console.log('Initial state:');
console.log('value():', slice.value());
console.log('isEven():', slice.isEven());

console.log('\nIncrementing...');
slice.increment();

console.log('After increment:');
console.log('value():', slice.value());
console.log('isEven():', slice.isEven()); // This should be false but might be true

// Let's also test the computed directly
console.log('\nTesting computed subscription:');
let computedChanges = 0;
const unsubscribe = slice.isEven.subscribe(() => {
  console.log('Computed changed, new value:', slice.isEven());
  computedChanges++;
});

console.log('Changes before increment:', computedChanges);
slice.increment();
console.log('Changes after increment:', computedChanges);

unsubscribe();