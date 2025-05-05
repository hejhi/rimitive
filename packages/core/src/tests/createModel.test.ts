import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

// Define types to use in tests
interface CountState {
  count: number;
}

interface NameState {
  name: string;
}

describe('createModel core function', () => {
  it('creates a model with getters', () => {
    // Create a test store
    const testStore = create(() => ({
      count: 0,
      name: 'test',
    }));

    // Create a subscriber with store
    const subscriber = withStoreSubscribe(testStore, (state) => ({
      count: state.count,
      name: state.name,
    }));

    // Create model with getters
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getCount: () => selectedState.count,
      getName: () => selectedState.name,
    }));

    // Initial state check
    expect(model.getCount()).toBe(0);
    expect(model.getName()).toBe('test');

    // Update the store and check that getters reflect changes
    testStore.setState({ count: 5, name: 'updated' });
    expect(model.getCount()).toBe(5);
    expect(model.getName()).toBe('updated');
  });

  it('adds mutation methods to model', () => {
    // Create a test store
    const testStore = create<CountState>(() => ({ count: 0 }));

    // Create a subscriber with store
    const subscriber = withStoreSubscribe(testStore, (state) => ({
      count: state.count,
    }));

    // Create model with getters and mutation methods
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getCount: () => selectedState.count,
      increment: () =>
        testStore.setState((state) => ({ count: state.count + 1 })),
      decrement: () =>
        testStore.setState((state) => ({ count: state.count - 1 })),
      setCount: (value: number) => testStore.setState({ count: value }),
    }));

    // Initial state check
    expect(model.getCount()).toBe(0);

    // Test increment mutation
    model.increment();
    expect(model.getCount()).toBe(1);

    // Test decrement mutation
    model.decrement();
    expect(model.getCount()).toBe(0);

    // Test setCount mutation
    model.setCount(10);
    expect(model.getCount()).toBe(10);
  });

  it('implements subscription chaining', () => {
    // Create two test stores
    const counterStore = create<CountState>(() => ({ count: 0 }));
    const userStore = create<NameState>(() => ({ name: 'test' }));

    // Create subscribers for both stores
    const counterSubscriber = withStoreSubscribe(counterStore, (state) => ({
      count: state.count,
    }));

    const userSubscriber = withStoreSubscribe(userStore, (state) => ({
      name: state.name,
    }));

    // Create models for both stores
    const { model: counterModel } = createModel(counterSubscriber)(
      (_set, _get, selectedState) => ({
        getCount: () => selectedState.count,
        increment: () =>
          counterStore.setState((state) => ({ count: state.count + 1 })),
      })
    );

    const { model: userModel } = createModel(userSubscriber)(
      (_set, _get, selectedState) => ({
        getName: () => selectedState.name,
        setName: (name: string) => userStore.setState({ name }),
      })
    );

    // Subscribe to both models
    const combinedSubscriber = {
      subscribe: (
        callback: (state: { count: number; name: string }) => void
      ) => {
        const unsubCounter = counterSubscriber.subscribe((counterState) => {
          const userState = userSubscriber.getState();
          callback({ ...counterState, ...userState });
        });

        const unsubUser = userSubscriber.subscribe((userState) => {
          const counterState = counterSubscriber.getState();
          callback({ ...counterState, ...userState });
        });

        return () => {
          unsubCounter();
          unsubUser();
        };
      },
      getState: () => {
        return {
          ...counterSubscriber.getState(),
          ...userSubscriber.getState(),
        };
      },
    };

    // Create combined model
    const { model: combinedModel } = createModel(combinedSubscriber)(
      (_set, _get, selectedState) => ({
        getCount: () => selectedState.count,
        getName: () => selectedState.name,
        getCountAndName: () => `${selectedState.count}-${selectedState.name}`,
      })
    );

    // Initial state check
    expect(combinedModel.getCount()).toBe(0);
    expect(combinedModel.getName()).toBe('test');
    expect(combinedModel.getCountAndName()).toBe('0-test');

    // Update counter and check combined model
    counterModel.increment();
    expect(combinedModel.getCount()).toBe(1);
    expect(combinedModel.getCountAndName()).toBe('1-test');

    // Update user and check combined model
    userModel.setName('updated');
    expect(combinedModel.getName()).toBe('updated');
    expect(combinedModel.getCountAndName()).toBe('1-updated');
  });

  it('adds state selection', () => {
    // Create a test store with multiple properties
    interface ExtendedState extends CountState, NameState {
      active: boolean;
      items: string[];
    }

    const testStore = create<ExtendedState>(() => ({
      count: 0,
      name: 'test',
      active: true,
      items: ['a', 'b', 'c'],
    }));

    // Create a subscriber with selective state
    const subscriber = withStoreSubscribe(testStore, (state) => ({
      // Only select count and name
      count: state.count,
      name: state.name,
    }));

    // Create model that uses selected state
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getCount: () => selectedState.count,
      getName: () => selectedState.name,
      // This should not be available in selectedState
      getActive: () => testStore.getState().active,
      getCountAndName: () => `${selectedState.count}-${selectedState.name}`,
    }));

    // Check that we can access selected properties
    expect(model.getCount()).toBe(0);
    expect(model.getName()).toBe('test');

    // Check that we can't access non-selected properties through selectedState
    // but can access them through the store directly
    expect(model.getActive()).toBe(true);

    // Update store and check that only selected state is reflected in the model
    testStore.setState({
      count: 5,
      name: 'updated',
      active: false,
      items: ['d', 'e', 'f'],
    });

    expect(model.getCount()).toBe(5);
    expect(model.getName()).toBe('updated');
    expect(model.getActive()).toBe(false);
    expect(model.getCountAndName()).toBe('5-updated');
  });
});
