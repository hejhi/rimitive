import { describe, it, expect } from 'vitest';
import { createStore, type Store } from './store';

describe('Component Reactivity Boundaries', () => {
  it('should demonstrate getter reactivity implications', () => {
    interface CounterState {
      count: number;
      multiplier: number;
    }

    const Counter = (store: Store<CounterState>) => {
      const ctx = store.getContext();

      // This computed will be created ONCE when component is created
      const doubledComputed = ctx.computed(() => store.state.count.value * 2);

      return {
        // GETTER: Creates reactive boundary - each access reads the signal
        get count() {
          return store.state.count.value;
        },

        // GETTER with computed: Still reactive, but computed is stable
        get doubledCount() {
          return doubledComputed.value;
        },

        // FUNCTION: Also reactive - each call reads the signal
        getCountDirectly: () => store.state.count.value,

        increment: () => store.state.count.value++,
      };
    };

    const store = createStore<CounterState>({ count: 0, multiplier: 2 });
    const counter = Counter(store);

    let effectRuns = 0;

    // Effect that uses the getter
    store.getContext().effect(() => {
      // This WILL track the signal because getter accesses it
      const value = counter.count;
      effectRuns++;
      console.log('Effect saw count:', value);
    });

    expect(effectRuns).toBe(1); // Initial run

    counter.increment();
    expect(effectRuns).toBe(2); // Effect re-runs because signal changed

    store.dispose();
  });

  it('should show the difference between getter and value patterns', () => {
    interface State {
      user: { name: string; age: number };
      settings: { theme: string };
    }

    // Pattern 1: Getter (Reactive)
    const ComponentWithGetters = (store: Store<State>) => {
      return {
        // ✅ REACTIVE: Each access reads the signal
        get userName() {
          return store.state.user.value.name;
        },
        get userAge() {
          return store.state.user.value.age;
        },
        get theme() {
          return store.state.settings.value.theme;
        },
      };
    };

    // Pattern 2: Captured Values (NOT Reactive)
    const ComponentWithValues = (store: Store<State>) => {
      // ❌ NOT REACTIVE: Values captured at creation time
      const user = store.state.user.value;
      const settings = store.state.settings.value;

      return {
        userName: user.name, // Static value!
        userAge: user.age, // Static value!
        theme: settings.theme, // Static value!
      };
    };

    const store1 = createStore<State>({
      user: { name: 'John', age: 30 },
      settings: { theme: 'light' },
    });

    const store2 = createStore<State>({
      user: { name: 'John', age: 30 },
      settings: { theme: 'light' },
    });

    const reactive = ComponentWithGetters(store1);
    const nonReactive = ComponentWithValues(store2);

    // Initial values are the same
    expect(reactive.userName).toBe('John');
    expect(nonReactive.userName).toBe('John');

    // Update the stores
    store1.state.user.value = { name: 'Jane', age: 31 };
    store2.state.user.value = { name: 'Jane', age: 31 };

    // Getter pattern reflects the change
    expect(reactive.userName).toBe('Jane');

    // Value pattern still has old value
    expect(nonReactive.userName).toBe('John'); // ❌ Stale!

    store1.dispose();
    store2.dispose();
  });

  it('should demonstrate computed creation timing', () => {
    interface State {
      items: number[];
      multiplier: number;
    }

    // Pattern 1: Computed in getter (BAD - creates new computed each access!)
    const BadPattern = (store: Store<State>) => {
      const ctx = store.getContext();

      return {
        // ❌ BAD: Creates new computed on every access!
        get total() {
          const computed = ctx.computed(() =>
            store.state.items.value.reduce((a: number, b: number) => a + b, 0)
          );
          return computed.value;
        },
      };
    };

    // Pattern 2: Computed created once (GOOD)
    const GoodPattern = (store: Store<State>) => {
      const ctx = store.getContext();

      // ✅ GOOD: Computed created once during component creation
      const totalComputed = ctx.computed(() =>
        store.state.items.value.reduce((a: number, b: number) => a + b, 0)
      );

      return {
        get total() {
          return totalComputed.value;
        },
      };
    };

    const store = createStore<State>({
      items: [1, 2, 3],
      multiplier: 2,
    });

    const bad = BadPattern(store);
    const good = GoodPattern(store);

    // Both work correctly
    expect(bad.total).toBe(6);
    expect(good.total).toBe(6);

    // But bad pattern creates memory leaks and performance issues
    // Each access to bad.total creates a new computed that never gets disposed!

    store.dispose();
  });

  it('should show effect tracking with different access patterns', () => {
    interface State {
      counter: { value: number; step: number };
      enabled: boolean;
    }

    const Component = (store: Store<State>) => {
      return {
        // Accessing nested property - tracks the counter signal
        get count() {
          return store.state.counter.value.value;
        },

        // Accessing another nested property - still tracks counter signal
        get step() {
          return store.state.counter.value.step;
        },

        // Returning the whole object - tracks the counter signal
        get counterObject() {
          return store.state.counter.value;
        },

        increment: () => {
          const current = store.state.counter.value;
          store.state.counter.value = {
            ...current,
            value: current.value + current.step,
          };
        },
      };
    };

    const store = createStore<State>({
      counter: { value: 0, step: 1 },
      enabled: true,
    });

    const component = Component(store);
    const ctx = store.getContext();

    let countEffectRuns = 0;
    let stepEffectRuns = 0;
    let objectEffectRuns = 0;

    // Effect tracking count property
    ctx.effect(() => {
      void component.count; // Tracks counter signal
      countEffectRuns++;
    });

    // Effect tracking step property
    ctx.effect(() => {
      void component.step; // Also tracks counter signal
      stepEffectRuns++;
    });

    // Effect tracking whole object
    ctx.effect(() => {
      void component.counterObject; // Tracks counter signal
      objectEffectRuns++;
    });

    expect(countEffectRuns).toBe(1);
    expect(stepEffectRuns).toBe(1);
    expect(objectEffectRuns).toBe(1);

    // Update counter - ALL effects run because they all track the counter signal
    component.increment();

    expect(countEffectRuns).toBe(2);
    expect(stepEffectRuns).toBe(2);
    expect(objectEffectRuns).toBe(2);

    // Even updating just the step triggers all effects
    store.state.counter.value = { ...store.state.counter.value, step: 2 };

    expect(countEffectRuns).toBe(3);
    expect(stepEffectRuns).toBe(3);
    expect(objectEffectRuns).toBe(3);

    store.dispose();
  });

  it('should demonstrate select for fine-grained reactivity', () => {
    interface State {
      user: { name: string; age: number; lastSeen: number };
    }

    const Component = (store: Store<State>) => {
      return {
        // Tracks entire user signal
        get userName() {
          return store.state.user.value.name;
        },

        get userAge() {
          return store.state.user.value.age;
        },

        updateName: (name: string) => {
          store.state.user.value = {
            ...store.state.user.value,
            name,
          };
        },

        touch: () => {
          store.state.user.value = {
            ...store.state.user.value,
            lastSeen: Date.now(),
          };
        },
      };
    };

    const store = createStore<State>({
      user: { name: 'John', age: 30, lastSeen: Date.now() },
    });

    const component = Component(store);
    const ctx = store.getContext();

    let normalSubscriptionRuns = 0;
    let selectSubscriptionRuns = 0;

    // Direct subscription to user signal
    const unsubNormal = ctx.subscribe(store.state.user, () => {
      normalSubscriptionRuns++;
    });

    // Subscription via select - only fires when name changes
    const nameSelect = ctx.select(store.state.user, (u) => u.name);
    const unsubSelect = ctx.subscribe(nameSelect, () => {
      selectSubscriptionRuns++;
    });

    // Update name - both subscriptions fire
    component.updateName('Jane');
    expect(normalSubscriptionRuns).toBe(1);
    expect(selectSubscriptionRuns).toBe(1);

    // Update lastSeen - only normal subscription fires!
    component.touch();
    expect(normalSubscriptionRuns).toBe(2); // Runs because user object changed
    expect(selectSubscriptionRuns).toBe(1); // Doesn't run because name didn't change!

    unsubNormal();
    unsubSelect();
    store.dispose();
  });
});
