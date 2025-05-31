import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { useView as useZustandView } from '@lattice/adapter-zustand/react';
import { useView as useReduxView } from '@lattice/adapter-redux/react';

// Create a test component
const testComponent = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    text: 'Hello',
    user: { name: 'John', role: 'admin' },
    increment: () => set({ count: get().count + 1 }),
    setText: (text: string) => set({ text })
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
    setText: m.setText
  }));

  // Different view types to test
  const simpleView = createSlice(model, (m) => ({
    count: m.count,
    text: m.text
  }));

  const computedView = () => createSlice(model, (m) => ({
    display: `Count: ${m.count}`,
    isEven: m.count % 2 === 0
  }));

  const complexView = createSlice(model, (m) => ({
    user: m.user,
    formattedName: `${m.user.name} (${m.user.role})`,
    metadata: {
      count: m.count,
      hasText: m.text.length > 0
    }
  }));

  return {
    model,
    actions,
    views: {
      simple: simpleView,
      computed: computedView,
      complex: complexView
    }
  };
});

// Test type inference with both adapters
function testTypeInference() {
  const zustandStore = createZustandAdapter(testComponent);
  const reduxStore = createReduxAdapter(testComponent);

  // Test 1: Direct property access on stores
  {
    // Both should allow direct access to actions
    const zActions = zustandStore.actions;
    const rActions = reduxStore.actions;
    
    // Type check: both should have increment and setText
    type ZActionsType = typeof zActions;
    type RActionsType = typeof rActions;
    
    // These should both be callable
    // zActions.increment();
    // rActions.increment();
  }

  // Test 2: View access
  {
    // Direct view access
    const zSimple = zustandStore.views.simple;
    const rSimple = reduxStore.views.simple;
    
    // Type check: both should be functions
    type ZSimpleType = typeof zSimple;  // Should be () => { count: number; text: string; }
    type RSimpleType = typeof rSimple;  // Should be () => { count: number; text: string; }
    
    // Call views
    const zSimpleResult = zSimple();
    const rSimpleResult = rSimple();
    
    // Type check results
    type ZSimpleResultType = typeof zSimpleResult;  // Should be { count: number; text: string; }
    type RSimpleResultType = typeof rSimpleResult;  // Should be { count: number; text: string; }
  }

  // Test 3: Hook usage (simulated)
  {
    // Zustand hook with key
    type ZustandViewResult = ReturnType<typeof useZustandView<
      typeof testComponent extends () => infer R ? R['model'] : never,
      typeof testComponent extends () => infer R ? R['actions'] : never,
      typeof testComponent extends () => infer R ? R['views'] : never,
      'simple'
    >>;

    // Redux hook with selector
    type ReduxViewResult = ReturnType<typeof useReduxView<
      any, // Model - simplified for this test
      typeof testComponent extends () => infer R ? R['actions'] : never,
      typeof testComponent extends () => infer R ? R['views'] : never,
      any  // K and ViewGetter - let TS infer
    >>;
  }

  // Test 4: Complex view access
  {
    const zComplex = zustandStore.views.complex();
    const rComplex = reduxStore.views.complex();
    
    // Both should have the same shape
    type ZComplexType = typeof zComplex;
    type RComplexType = typeof rComplex;
    
    // Access nested properties
    const zUserName = zComplex.user.name;
    const rUserName = rComplex.user.name;
    
    const zMetaCount = zComplex.metadata.count;
    const rMetaCount = rComplex.metadata.count;
  }

  // Test 5: Computed view access
  {
    const zComputed = zustandStore.views.computed();
    const rComputed = reduxStore.views.computed();
    
    type ZComputedType = typeof zComputed;
    type RComputedType = typeof rComputed;
    
    // Both should have display and isEven
    const zDisplay = zComputed.display;
    const rDisplay = rComputed.display;
  }

  // Return type information for inspection
  return {
    zustand: {
      store: zustandStore,
      simpleView: zustandStore.views.simple(),
      computedView: zustandStore.views.computed(),
      complexView: zustandStore.views.complex()
    },
    redux: {
      store: reduxStore,
      simpleView: reduxStore.views.simple(),
      computedView: reduxStore.views.computed(),
      complexView: reduxStore.views.complex()
    }
  };
}

// Export types for external inspection
export type TestResults = ReturnType<typeof testTypeInference>;
export { testComponent, testTypeInference };