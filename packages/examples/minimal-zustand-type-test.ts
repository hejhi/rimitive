import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Minimal component with just one view
const minimalCounter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  }));

  const countView = createSlice(model, (m) => ({
    value: m.count,
    onClick: m.increment,
  }));

  return {
    model,
    actions: createSlice(model, (m) => ({
      increment: m.increment,
    })),
    views: {
      count: countView,
    },
  };
});

// Test 1: Basic adapter creation
const adapter1 = createZustandAdapter(minimalCounter);

// Test 2: With explicit type annotation
const adapter2: ReturnType<typeof createZustandAdapter<typeof minimalCounter>> = 
  createZustandAdapter(minimalCounter);

// Test 3: Extract component type first
type MinimalCounterComponent = typeof minimalCounter;
const adapter3 = createZustandAdapter<MinimalCounterComponent>(minimalCounter);

// Test type inference on views
const testTypeInference = () => {
  // Does this infer correctly?
  const view1 = adapter1.views.count();
  console.log('View 1 type:', view1);
  
  // What about with explicit typing?
  const view2 = adapter2.views.count();
  console.log('View 2 type:', view2);
  
  // And with pre-extracted type?
  const view3 = adapter3.views.count();
  console.log('View 3 type:', view3);
  
  // Test if methods are callable
  view1.onClick();
  view2.onClick();
  view3.onClick();
  
  // Test if properties are accessible
  console.log('Values:', view1.value, view2.value, view3.value);
};

// Export for type checking
export { adapter1, adapter2, adapter3, testTypeInference };