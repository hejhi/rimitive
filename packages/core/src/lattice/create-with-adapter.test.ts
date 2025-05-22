/**
 * Tests for createComponentWithAdapter - the pluggable state architecture
 * 
 * This tests the fundamental adapter pattern where components are created 
 * with factory-time models but need to access runtime state through adapters.
 */

import { describe, it, expect } from 'vitest';

describe('createComponentWithAdapter', () => {
  it('should create component with factory-time model and selectors', () => {
    // First, test the basic pattern that should work:
    // Components created with factories, not yet wired to runtime state
    
    // Define mock model type for factory-time creation
    type CounterModel = {
      count: number;
      increment(): void;
    };
    
    // Create a mock model for factory-time composition
    const mockModel: CounterModel = {
      count: 5,
      increment: () => {},
    };
    
    // Component should be created successfully with factory-time model
    expect(mockModel.count).toBe(5);
    expect(typeof mockModel.increment).toBe('function');
  });
  
  it('should create selectors that can access runtime state through adapters', async () => {
    // Import the necessary factories
    const { createModel } = await import('../model/create');
    const { from } = await import('../shared/from/from');
    
    type CounterModel = {
      count: number;
      increment(): void;
    };
    
    // Create a mock model for factory-time composition (like in real usage)
    const mockModel: CounterModel = {
      count: 5,
      increment: () => {},
    };
    
    // Create a mock model factory for factory-time composition
    const mockModelFactory = createModel<CounterModel>(() => mockModel);
    
    // Create selectors using the from() API with the mock model factory
    const selectors = from(mockModelFactory).createSelectors(({ model }) => ({
      count: model().count,
      doubled: model().count * 2,
    }));
    
    // At this point, selectors are created but should eventually access runtime state
    expect(selectors).toBeDefined();
    expect(typeof selectors).toBe('function');
    
    // The key insight: selectors should be able to access different runtime state
    // than the factory-time mock model. This is the adapter pattern we need to solve.
    
    // Create an actual runtime model with different state
    const runtimeModel = createModel<CounterModel>(({ set }) => ({
      count: 42,  // Different from mock model's count of 5
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));
    
    // This is where the adapter should bridge factory-time to runtime
    // We need a way to wire selectors to access the runtime model instead of mock model
    expect(runtimeModel).toBeDefined();
    
    // The problem: selectors created with mockModel should be able to access runtimeModel state
    // This is what createComponentWithAdapter should solve
  });
  
  it('should implement createComponentWithAdapter for bridging factory-time to runtime', async () => {
    // This test defines what createComponentWithAdapter should do
    const { createModel } = await import('../model/create');
    const { from } = await import('../shared/from/from');
    const { createComponent } = await import('./create');
    
    type CounterModel = {
      count: number;
      increment(): void;
    };
    
    // Step 1: Create a component with factory-time models (for type safety)
    const component = createComponent(() => {
      // Factory-time mock model (for type safety and composition)
      const mockModel: CounterModel = {
        count: 5,
        increment: () => {},
      };
      const model = createModel<CounterModel>(() => mockModel);
      
      const selectors = from(model).createSelectors(({ model }) => ({
        count: model().count,
        doubled: model().count * 2,
      }));
      
      const actions = from(model).createActions(({ model }) => ({
        increment: model().increment,
      }));
      
      const counterView = from(selectors)
        .withActions(actions)
        .createView(({ selectors, actions }) => ({
          'data-count': selectors().count,
          onClick: () => actions().increment(),
        }));
      
      return { model, selectors, actions, view: { counter: counterView } };
    });
    
    // Step 2: The adapter should bridge this component to runtime state
    // This is what we need to implement
    expect(component).toBeDefined();
    
    // The adapter should allow using the same component structure
    // but with different runtime state adapters (Zustand, etc.)
  });
  
  it('should create an adapter that bridges factory components to runtime state', async () => {
    // This test will fail until we implement createComponentWithAdapter
    const { createComponentWithAdapter } = await import('./create-with-adapter');
    const { createModel } = await import('../model/create');
    const { from } = await import('../shared/from/from');
    const { createComponent } = await import('./create');
    
    type CounterModel = {
      count: number;
      increment(): void;
    };
    
    // Create a component with factory-time models
    const componentFactory = createComponent(() => {
      const mockModel: CounterModel = {
        count: 5,
        increment: () => {},
      };
      const model = createModel<CounterModel>(() => mockModel);
      
      const selectors = from(model).createSelectors(({ model }) => ({
        count: model().count,
        doubled: model().count * 2,
      }));
      
      const actions = from(model).createActions(({ model }) => ({
        increment: model().increment,
      }));
      
      const counterView = from(selectors)
        .withActions(actions)
        .createView(({ selectors, actions }) => ({
          'data-count': selectors().count,
          onClick: () => actions().increment(),
        }));
      
      return { model, selectors, actions, view: { counter: counterView } };
    });
    
    // Create a runtime model with different state
    const runtimeModel = createModel<CounterModel>(({ set }) => ({
      count: 42,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));
    
    // Create an adapter that bridges the component to runtime state
    const adaptedComponent = createComponentWithAdapter(componentFactory, {
      model: runtimeModel,
    });
    
    // The adapted component should access runtime state (42), not factory-time state (5)
    expect(adaptedComponent).toBeDefined();
    expect(adaptedComponent.originalFactory).toBe(componentFactory);
    expect(adaptedComponent.runtimeModel).toBe(runtimeModel);
    expect(adaptedComponent.factoryComponent).toBeDefined();
  });
  
  it('should bridge selectors to access runtime state instead of factory-time state', async () => {
    // This test will verify the actual bridging logic
    const { createComponentWithAdapter } = await import('./create-with-adapter');
    const { createModel } = await import('../model/create');
    const { from } = await import('../shared/from/from');
    const { createComponent } = await import('./create');
    
    type CounterModel = {
      count: number;
      increment(): void;
    };
    
    // Create component with factory-time models
    const componentFactory = createComponent(() => {
      const mockModel: CounterModel = {
        count: 5,
        increment: () => {},
      };
      const model = createModel<CounterModel>(() => mockModel);
      
      const selectors = from(model).createSelectors(({ model }) => ({
        count: model().count,
        doubled: model().count * 2,
      }));
      
      const actions = from(model).createActions(({ model }) => ({
        increment: model().increment,
      }));
      
      const counterView = from(selectors)
        .withActions(actions)
        .createView(({ selectors, actions }) => ({
          'data-count': selectors().count,
          onClick: () => actions().increment(),
        }));
      
      return { model, selectors, actions, view: { counter: counterView } };
    });
    
    // Create runtime model
    const runtimeModel = createModel<CounterModel>(({ set }) => ({
      count: 42,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));
    
    // Create adapter
    const adaptedComponent = createComponentWithAdapter(componentFactory, {
      model: runtimeModel,
    });
    
    // This test will verify the bridging once we implement it
    expect(adaptedComponent).toBeDefined();
    expect(adaptedComponent.bridgedSelectors).toBeDefined();
    expect(typeof adaptedComponent.bridgedSelectors.factory).toBe('function');
    expect(adaptedComponent.bridgedSelectors.runtime).toBe(runtimeModel);
    
    // The key test: when we invoke the adapted component's selectors,
    // they should access runtime state (42) not factory-time state (5)
    
    // This is what we want to achieve:
    // 1. Factory component was created with mock model (count: 5)
    // 2. Runtime model has different state (count: 42)
    // 3. Adapted selectors should return runtime state values
    
    // TODO: Implement test that verifies selectors return runtime values
    // const result = adaptedComponent.invoke(); // or similar API
    // expect(result.selectors.count).toBe(42); // runtime state
    // expect(result.selectors.doubled).toBe(84); // runtime computed value
  });
});