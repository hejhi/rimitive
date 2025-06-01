import { createComponent, createModel, createSlice } from '@lattice/core';
import { createReduxAdapter } from './index';

// Test computed view type inference
const component = createComponent(() => {
  const model = createModel<{
    count: number;
    increment: () => void;
  }>(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  }));

  const countSlice = createSlice(model, (m) => ({
    count: m.count,
  }));

  // Transformed view
  const doubledView = countSlice((state) => ({
    doubled: state.count * 2,
  }));

  return {
    model,
    actions: createSlice(model, (m) => ({
      increment: m.increment,
    })),
    views: {
      doubled: doubledView,
    },
  };
});

const store = createReduxAdapter(component);

// This should work without type errors now
const result = store.views.doubled();
console.log(result.doubled); // No type error!