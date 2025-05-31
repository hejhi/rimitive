import { createComponent, createModel, createSlice, type SliceFactory } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

// Let's analyze the ViewType transformation
type TestModel = { count: number };
type TestSlice = { value: number };

// What the adapter expects for views
type ViewDefinition = SliceFactory<TestModel, TestSlice> | (() => SliceFactory<TestModel, TestSlice>);

// The ViewType transformation from the adapter
type ViewType<Model, T> = T extends () => SliceFactory<Model, infer S>
  ? () => S
  : T extends SliceFactory<Model, infer S>
    ? () => S
    : never;

// Test the transformation
type StaticViewDef = SliceFactory<TestModel, TestSlice>;
type ComputedViewDef = () => SliceFactory<TestModel, TestSlice>;

type StaticViewResult = ViewType<TestModel, StaticViewDef>;
type ComputedViewResult = ViewType<TestModel, ComputedViewDef>;

// Should both be () => TestSlice
const staticTest: StaticViewResult = () => ({ value: 42 });
const computedTest: ComputedViewResult = () => ({ value: 42 });

// Now test with a real component
const testComponent = createComponent(() => {
  const model = createModel<TestModel>(({ set, get }) => ({
    count: 0,
  }));

  const testView = createSlice(model, (m) => ({
    value: m.count,
  }));

  return {
    model,
    actions: createSlice(model, () => ({})),
    views: {
      test: testView,
    },
  };
});

// What type does TypeScript infer for the component?
type ComponentType = typeof testComponent;
type ComponentReturnType = ReturnType<ComponentType>;
type ComponentViews = ComponentReturnType['views'];
type TestViewType = ComponentViews['test'];

// Try the adapter
const adapter = createZustandAdapter(testComponent);
type AdapterViews = typeof adapter.views;
type AdapterTestView = AdapterViews['test'];

// This should work
const result = adapter.views.test();

export { staticTest, computedTest, adapter, result };