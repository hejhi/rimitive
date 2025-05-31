import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Create the simplest possible component
const simpleCounter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 })
  }));

  const countView = createSlice(model, (m) => ({
    value: m.count
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment
  }));

  return {
    model,
    actions,
    views: {
      count: countView
    }
  };
});

// Create zustand adapter
const store = createZustandAdapter(simpleCounter);

// Test type access
const testTypes = () => {
  // Test store structure
  console.log('Store properties:', Object.keys(store));
  
  // Can we access actions?
  const actions = store.actions;
  console.log('Actions:', actions);
  console.log('Type of increment:', typeof store.actions.increment);

  // Can we access views?
  const views = store.views;
  console.log('Views:', views);

  // Can we access specific view?
  const countView = store.views.count;
  console.log('Count view:', countView);

  // Can we call the view?
  const viewResult = store.views.count();
  console.log('View result:', viewResult);
  
  // Test action execution
  console.log('Initial count:', store.views.count());
  store.actions.increment();
  console.log('After increment:', store.views.count());

  // Type checks
  console.log('Type of store:', typeof store);
  console.log('Type of subscribe:', typeof store.subscribe);
  console.log('Type of views:', typeof store.views);
  console.log('Type of views.count:', typeof store.views.count);
};

// Run the test
testTypes();

// Export for type inspection
export { store, simpleCounter };