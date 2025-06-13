// Trace execution path of store.counter.increment()

import { createZustandAdapter } from '@lattice/adapter-zustand';

// Create a simple component
const createComponent = (createStore) => {
  console.log('1. createComponent called with createStore function');
  
  const createSlice = createStore({ count: 0 });
  console.log('2. createStore called, returned createSlice function');
  
  const counter = createSlice(({ get, set }) => {
    console.log('3. createSlice called with get/set tools');
    
    // Wrap increment to trace its execution
    const originalIncrement = () => {
      console.log('5. increment() called');
      console.log('6. Calling get() to read current state');
      const currentCount = get().count;
      console.log(`7. Current count is: ${currentCount}`);
      console.log('8. Calling set() to update state');
      set({ count: currentCount + 1 });
      console.log('9. set() completed');
    };
    
    return {
      increment: originalIncrement,
      getCount: () => get().count,
    };
  });
  
  console.log('4. Slice created with increment and getCount methods');
  return { counter };
};

// Create the store
console.log('=== Creating Lattice + Zustand store ===');
const store = createZustandAdapter(createComponent);

// Call increment and trace execution
console.log('\n=== Calling store.counter.increment() ===');
store.counter.increment();

console.log('\n=== Final count:', store.counter.getCount(), '===');