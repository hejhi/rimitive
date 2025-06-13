import { createStore } from './packages/core/src/index';

// Test case to understand spread behavior in Lattice slices

// Create a store with some initial state
const createSlice = createStore({ 
  count: 0, 
  name: 'initial',
  taxRate: 0.08,
  discount: 0.1
});

// Create a base slice that we'll spread into another
const baseSlice = createSlice(({ get, set }) => ({
  count: () => get().count,
  increment: () => set({ count: get().count + 1 }),
  name: () => get().name,
  setName: (name: string) => set({ name })
}));

// Create another slice that might be referenced
const anotherSlice = createSlice(({ get, set }) => ({
  getTaxRate: () => get().taxRate,
  getDiscount: () => get().discount,
  applyDiscount: (price: number) => price * (1 - get().discount)
}));

// Test 1: What happens when we spread a slice directly?
console.log('=== Test 1: Direct spread ===');
const pricing = createSlice(({ get }) => ({
  taxRate: () => get().taxRate,
  discount: () => get().discount,
  ...anotherSlice,
}));

console.log('pricing.taxRate():', pricing.taxRate());
console.log('pricing.getTaxRate():', pricing.getTaxRate());
console.log('pricing.applyDiscount(100):', pricing.applyDiscount(100));

// Test 2: Are the methods bound to the original state or the new state?
console.log('\n=== Test 2: State binding ===');
console.log('Initial count:', baseSlice.count());
baseSlice.increment();
console.log('After increment:', baseSlice.count());

const combinedSlice = createSlice(({ get, set }) => ({
  myCount: () => get().count,
  ...baseSlice,
}));

console.log('combinedSlice.count():', combinedSlice.count());
console.log('combinedSlice.myCount():', combinedSlice.myCount());

// Test 3: What if we modify state through the spread methods?
console.log('\n=== Test 3: State modification through spread methods ===');
combinedSlice.increment();
console.log('After combinedSlice.increment():');
console.log('  baseSlice.count():', baseSlice.count());
console.log('  combinedSlice.count():', combinedSlice.count());
console.log('  combinedSlice.myCount():', combinedSlice.myCount());

// Test 4: Name conflicts
console.log('\n=== Test 4: Name conflicts ===');
const conflictSlice = createSlice(({ get, set }) => ({
  count: () => get().count * 10, // Different implementation
  ...baseSlice, // This should override the above
}));

console.log('conflictSlice.count():', conflictSlice.count());

// Test 5: Spreading into a new store instance
console.log('\n=== Test 5: Different store instances ===');
const createSlice2 = createStore({ count: 100, name: 'other' });

const otherSlice = createSlice2(({ get, set }) => ({
  ...baseSlice, // Methods from a different store
  ownCount: () => get().count,
}));

console.log('otherSlice.count():', otherSlice.count()); // Which count?
console.log('otherSlice.ownCount():', otherSlice.ownCount());
otherSlice.increment();
console.log('After otherSlice.increment():');
console.log('  baseSlice.count():', baseSlice.count());
console.log('  otherSlice.count():', otherSlice.count());
console.log('  otherSlice.ownCount():', otherSlice.ownCount());