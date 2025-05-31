import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Test 1: Simplest possible component
const simpleComponent = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    value: 42,
  }));

  const valueView = createSlice(model, (m) => ({
    data: m.value,
  }));

  return {
    model,
    actions: createSlice(model, () => ({})),
    views: {
      value: valueView,
    },
  };
});

// Let's see what TypeScript infers
const adapter = createZustandAdapter(simpleComponent);

// Test what we get
type AdapterType = typeof adapter;
type ViewsType = typeof adapter.views;
type ValueViewType = typeof adapter.views.value;

// Try to use it
const viewResult = adapter.views.value();
console.log('View result:', viewResult);

// Test 2: Component with explicit type parameters
const typedComponent = createComponent<
  { value: number },
  {},
  { value: ReturnType<typeof createSlice<{ value: number }, { data: number }>> }
>(() => {
  const model = createModel<{ value: number }>(({ set, get }) => ({
    value: 42,
  }));

  const valueView = createSlice(model, (m) => ({
    data: m.value,
  }));

  return {
    model,
    actions: createSlice(model, () => ({})),
    views: {
      value: valueView,
    },
  };
});

const typedAdapter = createZustandAdapter(typedComponent);
const typedViewResult = typedAdapter.views.value();

// Export for type checking
export { adapter, typedAdapter, viewResult, typedViewResult };
export type { AdapterType, ViewsType, ValueViewType };