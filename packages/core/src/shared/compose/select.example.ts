/**
 * Example code that demonstrates the type error when filtering selectors used by views
 * 
 * This is not a runnable test - it just documents the code pattern that would cause a type error
 */

// Import statements (commented to prevent import errors in typecheck)
// import { createComponent } from '../../lattice/create';
// import { extendComponent } from '../../lattice/compose';
// import { compose } from './fluent';
// import { createModel } from '../../model/create';
// import { createSelectors } from '../../selectors/create';
// import { createActions } from '../../actions/create';
// import { createView } from '../../view/create';

/**
 * EXAMPLE CODE PATTERN THAT WOULD ERROR
 * 
 * This demonstrates how a type error would occur when a component tries to filter out
 * selectors that are needed by a view in a composed component.
 */

/*
// 1. First, create the base component
const baseComponent = createComponent(() => {
  // Model with count and increment
  const model = createModel(({ set }) => ({
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 }))
  }));
  
  // Selectors that include both count and isPositive
  const selectors = createSelectors({ model }, ({ model }) => ({
    count: model().count,
    isPositive: model().count > 0
  }));
  
  // Actions that delegate to the model
  const actions = createActions({ model }, ({ model }) => ({
    increment: model().increment
  }));
  
  // View that uses BOTH count and isPositive selectors
  const counterView = createView({ selectors }, ({ selectors }) => ({
    'data-count': selectors().count,
    'data-positive': selectors().isPositive
  }));
  
  return {
    model,
    selectors,
    actions,
    view: { counter: counterView }
  };
});

// 2. Then, try to extend it but filter out the isPositive selector
const extendedComponent = extendComponent(baseComponent, ({ selectors, model, actions, view }) => {
  // PROBLEMATIC CODE: we're filtering out the isPositive selector
  // which is needed by the counterView
  const filteredSelectors = compose(selectors).select(base => ({
    count: base.count
    // isPositive is intentionally omitted but required by counterView
  }));
  
  return {
    // We return the filtered selectors but keep the original views
    selectors: filteredSelectors,
    // This causes a type error because view.counter requires isPositive
    view: view 
  };
});
*/

/**
 * CORRECT PATTERN
 * 
 * The proper way to handle this is to either:
 * 1. Keep all selectors required by views
 * 2. Only include views that are compatible with the filtered selectors
 * 3. Create new views that only use the available selectors
 */

/*
// Approach 1: Keep all required selectors
const safeExtension1 = extendComponent(baseComponent, ({ selectors, view }) => {
  const safeSelectors = compose(selectors).select(base => ({
    count: base.count,
    isPositive: base.isPositive // Keep this selector since views need it
  }));
  
  return {
    selectors: safeSelectors,
    view: view  // Now this is type-safe
  };
});

// Approach 2: Only include compatible views
const safeExtension2 = extendComponent(baseComponent, ({ selectors, model, actions, view }) => {
  const filteredSelectors = compose(selectors).select(base => ({
    count: base.count
    // Intentionally omit isPositive
  }));
  
  // Create a new view that doesn't depend on the omitted selector
  const counterView = createView({ selectors: filteredSelectors }, ({ selectors }) => ({
    'data-count': selectors().count
    // Doesn't try to use isPositive
  }));
  
  return {
    selectors: filteredSelectors,
    // Provide only compatible views
    view: {
      counter: counterView
    }
  };
});
*/