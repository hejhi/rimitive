import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';

// Create a simple component for testing
const counter = createComponent(() => {
  const model = createModel(({ set, get }) => ({
    count: 0,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 })
  }));

  const actions = createSlice(model, (m) => ({
    increment: m.increment,
    decrement: m.decrement
  }));

  const displayView = createSlice(model, (m) => ({
    value: m.count,
    label: `Count: ${m.count}`
  }));

  const buttonView = createSlice(model, (m) => ({
    onClick: select(actions, (a) => a.increment),
    disabled: false,
    text: 'Increment'
  }));

  return {
    model,
    actions,
    views: {
      display: displayView,
      button: buttonView
    }
  };
});

// Create adapters
const zustandStore = createZustandAdapter(counter);
const reduxStore = createReduxAdapter(counter);

// Type extraction tests
namespace TypeTests {
  // Test 1: Store types
  export type ZustandStoreType = typeof zustandStore;
  export type ReduxStoreType = typeof reduxStore;

  // Test 2: Actions types
  export type ZustandActionsType = typeof zustandStore.actions;
  export type ReduxActionsType = typeof reduxStore.actions;

  // Test 3: Views types  
  export type ZustandViewsType = typeof zustandStore.views;
  export type ReduxViewsType = typeof reduxStore.views;

  // Test 4: Individual view types
  export type ZustandDisplayView = typeof zustandStore.views.display;
  export type ReduxDisplayView = typeof reduxStore.views.display;

  // Test 5: View result types
  export type ZustandDisplayResult = ReturnType<typeof zustandStore.views.display>;
  export type ReduxDisplayResult = ReturnType<typeof reduxStore.views.display>;

  // Test 6: Hook parameter types
  export type ZustandHookStore = Parameters<typeof import('@lattice/adapter-zustand/react').useView>[0];
  export type ReduxHookStore = Parameters<typeof import('@lattice/adapter-redux/react').useView>[0];
}

// Runtime tests to verify behavior
function runtimeTests() {
  console.log('=== Runtime Type Tests ===\n');

  // Test actions
  console.log('Actions type check:');
  console.log('Zustand actions:', zustandStore.actions);
  console.log('Redux actions:', reduxStore.actions);
  console.log('Both have increment?', 
    'increment' in zustandStore.actions && 
    'increment' in reduxStore.actions
  );

  // Test views
  console.log('\nViews type check:');
  console.log('Zustand views:', zustandStore.views);
  console.log('Redux views:', reduxStore.views);
  
  // Test view execution
  console.log('\nView execution:');
  const zDisplay = zustandStore.views.display();
  const rDisplay = reduxStore.views.display();
  console.log('Zustand display result:', zDisplay);
  console.log('Redux display result:', rDisplay);
  
  // Test button view
  const zButton = zustandStore.views.button();
  const rButton = reduxStore.views.button();
  console.log('\nButton views:');
  console.log('Zustand button:', zButton);
  console.log('Redux button:', rButton);
  console.log('Both have onClick?', 
    'onClick' in zButton && 
    'onClick' in rButton
  );
  
  // Test action execution
  console.log('\nAction execution:');
  console.log('Initial state:');
  console.log('Zustand:', zustandStore.views.display());
  console.log('Redux:', reduxStore.views.display());
  
  zustandStore.actions.increment();
  reduxStore.actions.increment();
  
  console.log('After increment:');
  console.log('Zustand:', zustandStore.views.display());
  console.log('Redux:', reduxStore.views.display());
}

// Export for type checking
export { counter, zustandStore, reduxStore, TypeTests, runtimeTests };