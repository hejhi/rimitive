import { describe, it, expect } from 'vitest';
import { createModel } from '../model';

interface CounterState {
  count: number;
}

interface CounterStateMutations extends CounterState {
  increment: () => void;
  decrement: () => void;
}

interface CounterStateSelectors extends CounterStateMutations {
  getCount: () => number;
  getDoubledCount: () => number;
}

interface CounterStateNested extends CounterState {
  increment: () => void;
  incrementTwice: () => void;
}

// New interfaces for testing additional mutation patterns
interface ComplexState {
  count: number;
  user: {
    name: string;
    preferences: {
      theme: string;
      notifications: boolean;
    };
  };
}

interface ComplexStateMutations extends ComplexState {
  incrementCount: () => void;
  updateUserName: (name: string) => void;
  updateTheme: (theme: string) => void;
  toggleNotifications: () => void;
  resetUser: () => void;
}

describe('createModel', () => {
  it('should create a model factory with initial state', () => {
    // Define a simple model with just state
    const model = createModel()<CounterState>(() => ({
      count: 0,
    }));

    // The model should be a function
    expect(model).toBeDefined();
    expect(typeof model).toBe('function');

    // Model factory should return a store with the defined state
    const modelInstance = model();
    expect(modelInstance.getState().count).toBe(0);
  });

  it('should support state mutations', () => {
    // Define a model with state and mutation methods
    const model = createModel()<CounterStateMutations>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    const modelInstance = model();

    // Initial state
    expect(modelInstance.getState().count).toBe(0);

    // Mutate state using model methods
    modelInstance.getState().increment();
    expect(modelInstance.getState().count).toBe(1);

    modelInstance.getState().decrement();
    expect(modelInstance.getState().count).toBe(0);
  });

  it('should support state selectors', () => {
    // Define a model with state and selector methods
    const model = createModel()<CounterStateSelectors>(({ set, get }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      getCount: () => get().count,
      getDoubledCount: () => get().count * 2,
    }));

    const modelInstance = model();

    // Test selectors with initial state
    expect(modelInstance.getState().getCount()).toBe(0);
    expect(modelInstance.getState().getDoubledCount()).toBe(0);

    // Test selectors after state change
    modelInstance.getState().increment();
    expect(modelInstance.getState().getCount()).toBe(1);
    expect(modelInstance.getState().getDoubledCount()).toBe(2);
  });

  it('should handle nested updates through get', () => {
    // Define a model with methods that use get() to access current state
    const model = createModel()<CounterStateNested>(({ set, get }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      incrementTwice: () => {
        get().increment();
        get().increment();
      },
    }));

    const modelInstance = model();

    // Initial state
    expect(modelInstance.getState().count).toBe(0);

    // Use method that calls other methods through get()
    modelInstance.getState().incrementTwice();
    expect(modelInstance.getState().count).toBe(2);
  });

  it('should return a new store instance each time the factory is called', () => {
    // Define a simple model
    const model = createModel()<CounterStateMutations>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // Create two instances
    const instance1 = model();
    const instance2 = model();

    // Instances should be different objects
    expect(instance1).not.toBe(instance2);

    // Modifying one instance should not affect the other
    instance1.getState().increment();
    expect(instance1.getState().count).toBe(1);
    expect(instance2.getState().count).toBe(0);
  });

  // Additional tests for different mutation patterns
  describe('Model State Mutations', () => {
    it('should support direct state replacement', () => {
      const model = createModel()<CounterStateMutations>(({ set }) => ({
        count: 0,
        increment: () => set({ count: 10 }), // Direct state replacement
        decrement: () => set((state) => ({ count: state.count - 1 })),
      }));

      const modelInstance = model();

      modelInstance.getState().increment();
      expect(modelInstance.getState().count).toBe(10);
    });

    it('should support mutation with parameters', () => {
      const model = createModel()<{
        count: number;
        setCount: (value: number) => void;
      }>(({ set }) => ({
        count: 0,
        setCount: (value: number) => set({ count: value }),
      }));

      const modelInstance = model();

      modelInstance.getState().setCount(42);
      expect(modelInstance.getState().count).toBe(42);
    });

    it('should handle complex nested state mutations', () => {
      const model = createModel()<ComplexStateMutations>(({ set }) => ({
        count: 0,
        user: {
          name: 'Default User',
          preferences: {
            theme: 'light',
            notifications: true,
          },
        },
        incrementCount: () => set((state) => ({ count: state.count + 1 })),
        updateUserName: (name: string) =>
          set((state) => ({
            user: {
              ...state.user,
              name,
            },
          })),
        updateTheme: (theme: string) =>
          set((state) => ({
            user: {
              ...state.user,
              preferences: {
                ...state.user.preferences,
                theme,
              },
            },
          })),
        toggleNotifications: () =>
          set((state) => ({
            user: {
              ...state.user,
              preferences: {
                ...state.user.preferences,
                notifications: !state.user.preferences.notifications,
              },
            },
          })),
        resetUser: () =>
          set(() => ({
            user: {
              name: 'Default User',
              preferences: {
                theme: 'light',
                notifications: true,
              },
            },
          })),
      }));

      const modelInstance = model();

      // Initial state
      expect(modelInstance.getState().count).toBe(0);
      expect(modelInstance.getState().user.name).toBe('Default User');
      expect(modelInstance.getState().user.preferences.theme).toBe('light');
      expect(modelInstance.getState().user.preferences.notifications).toBe(
        true
      );

      // Test each mutation
      modelInstance.getState().incrementCount();
      expect(modelInstance.getState().count).toBe(1);

      modelInstance.getState().updateUserName('John Doe');
      expect(modelInstance.getState().user.name).toBe('John Doe');
      expect(modelInstance.getState().user.preferences.theme).toBe('light'); // Unchanged

      modelInstance.getState().updateTheme('dark');
      expect(modelInstance.getState().user.name).toBe('John Doe'); // Unchanged
      expect(modelInstance.getState().user.preferences.theme).toBe('dark');

      modelInstance.getState().toggleNotifications();
      expect(modelInstance.getState().user.preferences.notifications).toBe(
        false
      );

      modelInstance.getState().resetUser();
      expect(modelInstance.getState().user.name).toBe('Default User');
      expect(modelInstance.getState().user.preferences.theme).toBe('light');
      expect(modelInstance.getState().user.preferences.notifications).toBe(
        true
      );
      expect(modelInstance.getState().count).toBe(1); // Unaffected by resetUser
    });

    it('should handle multiple mutations in a single update', () => {
      const model = createModel()<{
        firstName: string;
        lastName: string;
        fullName: string;
        updateName: (first: string, last: string) => void;
      }>(({ set }) => ({
        firstName: '',
        lastName: '',
        fullName: '',
        updateName: (first: string, last: string) =>
          set(() => ({
            firstName: first,
            lastName: last,
            fullName: `${first} ${last}`,
          })),
      }));

      const modelInstance = model();

      modelInstance.getState().updateName('Jane', 'Smith');
      expect(modelInstance.getState().firstName).toBe('Jane');
      expect(modelInstance.getState().lastName).toBe('Smith');
      expect(modelInstance.getState().fullName).toBe('Jane Smith');
    });

    it('should preserve immutability between updates', () => {
      const model = createModel()<{
        items: string[];
        addItem: (item: string) => void;
      }>(({ set }) => ({
        items: [],
        addItem: (item: string) =>
          set((state) => ({
            items: [...state.items, item],
          })),
      }));

      const modelInstance = model();

      const initialState = modelInstance.getState();
      modelInstance.getState().addItem('item1');

      // Check that the original array wasn't modified
      expect(initialState.items.length).toBe(0);
      expect(modelInstance.getState().items.length).toBe(1);
      expect(modelInstance.getState().items[0]).toBe('item1');

      // Test a second update
      const secondState = modelInstance.getState();
      modelInstance.getState().addItem('item2');

      expect(secondState.items.length).toBe(1);
      expect(modelInstance.getState().items.length).toBe(2);
      expect(modelInstance.getState().items[1]).toBe('item2');
    });
  });

  // Additional tests for state selectors
  describe('Model State Selectors', () => {
    it('should support basic state selectors', () => {
      const model = createModel()<{
        count: number;
        getCount: () => number;
      }>(({ get }) => ({
        count: 0,
        getCount: () => get().count,
      }));

      const modelInstance = model();
      expect(modelInstance.getState().getCount()).toBe(0);
    });

    it('should support computed selectors', () => {
      const model = createModel()<{
        count: number;
        increment: () => void;
        getCount: () => number;
        getDoubledCount: () => number;
        isPositive: () => boolean;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        getCount: () => get().count,
        getDoubledCount: () => get().count * 2,
        isPositive: () => get().count > 0,
      }));

      const modelInstance = model();

      // Test initial computed values
      expect(modelInstance.getState().getCount()).toBe(0);
      expect(modelInstance.getState().getDoubledCount()).toBe(0);
      expect(modelInstance.getState().isPositive()).toBe(false);

      // Change state and test updated computed values
      modelInstance.getState().increment();
      expect(modelInstance.getState().getCount()).toBe(1);
      expect(modelInstance.getState().getDoubledCount()).toBe(2);
      expect(modelInstance.getState().isPositive()).toBe(true);
    });

    it('should support selectors with parameters', () => {
      const model = createModel()<{
        items: string[];
        getItem: (index: number) => string | undefined;
        findItem: (predicate: (item: string) => boolean) => string | undefined;
      }>(({ get }) => ({
        items: ['apple', 'banana', 'cherry'],
        getItem: (index: number) => get().items[index],
        findItem: (predicate: (item: string) => boolean) =>
          get().items.find(predicate),
      }));

      const modelInstance = model();

      expect(modelInstance.getState().getItem(0)).toBe('apple');
      expect(modelInstance.getState().getItem(1)).toBe('banana');
      expect(
        modelInstance.getState().findItem((item) => item.startsWith('c'))
      ).toBe('cherry');
      expect(
        modelInstance.getState().findItem((item) => item.startsWith('d'))
      ).toBeUndefined();
    });

    it('should allow selectors to work with complex nested state', () => {
      interface NestedState {
        user: {
          profile: {
            name: string;
            preferences: {
              theme: string;
            };
          };
          active: boolean;
        };
        getUserName: () => string;
        getTheme: () => string;
        isActive: () => boolean;
      }

      const model = createModel()<NestedState>(({ get }) => ({
        user: {
          profile: {
            name: 'John Doe',
            preferences: {
              theme: 'dark',
            },
          },
          active: true,
        },
        getUserName: () => get().user.profile.name,
        getTheme: () => get().user.profile.preferences.theme,
        isActive: () => get().user.active,
      }));

      const modelInstance = model();

      expect(modelInstance.getState().getUserName()).toBe('John Doe');
      expect(modelInstance.getState().getTheme()).toBe('dark');
      expect(modelInstance.getState().isActive()).toBe(true);
    });

    it('should support selectors that use other selectors', () => {
      const model = createModel()<{
        count: number;
        getCount: () => number;
        getDoubledCount: () => number;
        getCountDescription: () => string;
      }>(({ get }) => ({
        count: 5,
        getCount: () => get().count,
        getDoubledCount: () => get().getCount() * 2,
        getCountDescription: () =>
          `Count is ${get().getCount()} and doubled is ${get().getDoubledCount()}`,
      }));

      const modelInstance = model();

      expect(modelInstance.getState().getCount()).toBe(5);
      expect(modelInstance.getState().getDoubledCount()).toBe(10);
      expect(modelInstance.getState().getCountDescription()).toBe(
        'Count is 5 and doubled is 10'
      );
    });
  });
});
