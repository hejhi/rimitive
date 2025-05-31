import { describe, it, expect } from 'vitest';
import { createReduxAdapter } from './index';
import { createComponent, createModel, createSlice, select } from '@lattice/core';

describe('Redux Adapter', () => {
  it('should export createReduxAdapter function', () => {
    expect(createReduxAdapter).toBeDefined();
    expect(typeof createReduxAdapter).toBe('function');
  });

  it('should create a working Redux store with basic counter', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        decrement: m.decrement,
      }));

      return {
        model,
        actions,
        views: {},
      };
    });

    const store = createReduxAdapter(counter);

    // Verify initial state
    expect(store.getState().count).toBe(0);

    // Test increment
    store.actions.increment();
    expect(store.getState().count).toBe(1);

    // Test decrement
    store.actions.decrement();
    expect(store.getState().count).toBe(0);

    // Multiple operations
    store.actions.increment();
    store.actions.increment();
    store.actions.increment();
    expect(store.getState().count).toBe(3);
  });

  it('should support complex state updates', () => {
    interface Todo {
      id: number;
      text: string;
      completed: boolean;
    }

    const todoApp = createComponent(() => {
      const model = createModel<{
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }>(({ set, get }) => ({
        todos: [],
        filter: 'all',
        addTodo: (text) => {
          const newTodo: Todo = {
            id: Date.now(),
            text,
            completed: false,
          };
          set({ todos: [...get().todos, newTodo] });
        },
        toggleTodo: (id) => {
          set({
            todos: get().todos.map((todo) =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            ),
          });
        },
        setFilter: (filter) => set({ filter }),
      }));

      const actions = createSlice(model, (m) => ({
        addTodo: m.addTodo,
        toggleTodo: m.toggleTodo,
        setFilter: m.setFilter,
      }));

      return {
        model,
        actions,
        views: {},
      };
    });

    const store = createReduxAdapter(todoApp);

    // Add todos
    store.actions.addTodo('First todo');
    store.actions.addTodo('Second todo');

    expect(store.getState().todos.length).toBe(2);
    expect(store.getState().todos[0].text).toBe('First todo');
    expect(store.getState().todos[0].completed).toBe(false);

    // Toggle todo
    const firstTodoId = store.getState().todos[0].id;
    store.actions.toggleTodo(firstTodoId);

    expect(store.getState().todos[0].completed).toBe(true);

    // Set filter
    store.actions.setFilter('completed');
    expect(store.getState().filter).toBe('completed');
  });

  it('should handle views correctly', () => {
    const component = createComponent(() => {
      const model = createModel<{
        firstName: string;
        lastName: string;
        age: number;
        setFirstName: (name: string) => void;
        setLastName: (name: string) => void;
        setAge: (age: number) => void;
      }>(({ set }) => ({
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        setFirstName: (name) => set({ firstName: name }),
        setLastName: (name) => set({ lastName: name }),
        setAge: (age) => set({ age }),
      }));

      const personalInfoSlice = createSlice(model, (m) => ({
        fullName: `${m.firstName} ${m.lastName}`,
        initials: `${m.firstName[0]}${m.lastName[0]}`,
        canVote: m.age >= 18,
        ageGroup: m.age < 18 ? 'minor' : m.age < 65 ? 'adult' : 'senior',
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({
          setFirstName: m.setFirstName,
          setLastName: m.setLastName,
          setAge: m.setAge,
        })),
        views: {
          personalInfo: personalInfoSlice,
        },
      };
    });

    const store = createReduxAdapter(component);

    // Test initial view
    let info = store.views.personalInfo();
    expect(info.fullName).toBe('John Doe');
    expect(info.initials).toBe('JD');
    expect(info.canVote).toBe(true);
    expect(info.ageGroup).toBe('adult');

    // Update name
    store.actions.setFirstName('Jane');
    info = store.views.personalInfo();
    expect(info.fullName).toBe('Jane Doe');
    expect(info.initials).toBe('JD');

    // Update age
    store.actions.setAge(17);
    info = store.views.personalInfo();
    expect(info.canVote).toBe(false);
    expect(info.ageGroup).toBe('minor');
  });

  it('should support subscriptions with proper cleanup', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m.increment })),
        views: {},
      };
    });

    const store = createReduxAdapter(counter);
    let callCount = 0;
    const values: number[] = [];

    const unsubscribe = store.subscribe(() => {
      callCount++;
      values.push(store.getState().count);
    });

    store.actions.increment();
    store.actions.increment();
    
    expect(callCount).toBe(2);
    expect(values).toEqual([1, 2]);

    // Unsubscribe
    unsubscribe();

    // Further updates should not trigger callback
    store.actions.increment();
    expect(callCount).toBe(2);
    expect(values).toEqual([1, 2]);
  });

  it('should handle select() markers in views', () => {
    const component = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
        disabled: boolean;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        disabled: false,
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        decrement: m.decrement,
      }));

      const countSlice = createSlice(model, (m) => ({
        value: m.count,
        isPositive: m.count > 0,
        isNegative: m.count < 0,
      }));

      // View with select() marker
      const controlsSlice = createSlice(model, (m) => ({
        onIncrement: select(actions, (a) => a.increment),
        onDecrement: select(actions, (a) => a.decrement),
        count: select(countSlice, (c) => c.value),
        disabled: m.disabled,
      }));

      return {
        model,
        actions,
        views: {
          controls: controlsSlice,
          count: countSlice,
        },
      };
    });

    const store = createReduxAdapter(component);
    const controls = store.views.controls();

    expect(typeof controls.onIncrement).toBe('function');
    expect(typeof controls.onDecrement).toBe('function');
    expect(controls.count).toBe(0);
    expect(controls.disabled).toBe(false);

    // Test that actions work through select()
    controls.onIncrement();
    expect(store.getState().count).toBe(1);

    const updatedControls = store.views.controls();
    expect(updatedControls.count).toBe(1);

    controls.onDecrement();
    controls.onDecrement();
    expect(store.views.count().isNegative).toBe(true);
  });

  it('should support computed views with transformations', () => {
    const component = createComponent(() => {
      const model = createModel<{
        items: Array<{ id: number; name: string; price: number }>;
        taxRate: number;
        addItem: (name: string, price: number) => void;
        setTaxRate: (rate: number) => void;
      }>(({ set, get }) => ({
        items: [],
        taxRate: 0.08,
        addItem: (name, price) => {
          const newItem = { id: Date.now(), name, price };
          set({ items: [...get().items, newItem] });
        },
        setTaxRate: (rate) => set({ taxRate: rate }),
      }));

      const cartSlice = createSlice(model, (m) => ({
        items: m.items,
        taxRate: m.taxRate,
      }));

      // Computed view
      const summaryView = () =>
        cartSlice((cart) => {
          const subtotal = cart.items.reduce((sum, item) => sum + item.price, 0);
          const tax = subtotal * cart.taxRate;
          const total = subtotal + tax;

          return {
            itemCount: cart.items.length,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            total: total.toFixed(2),
            isEmpty: cart.items.length === 0,
          };
        });

      return {
        model,
        actions: createSlice(model, (m) => ({
          addItem: m.addItem,
          setTaxRate: m.setTaxRate,
        })),
        views: {
          summary: summaryView,
        },
      };
    });

    const store = createReduxAdapter(component);

    // Initial state
    let summary = store.views.summary();
    expect(summary.isEmpty).toBe(true);
    expect(summary.subtotal).toBe('0.00');

    // Add items
    store.actions.addItem('Book', 19.99);
    store.actions.addItem('Pen', 2.50);

    summary = store.views.summary();
    expect(summary.itemCount).toBe(2);
    expect(summary.subtotal).toBe('22.49');
    expect(summary.tax).toBe('1.80');
    expect(summary.total).toBe('24.29');

    // Change tax rate
    store.actions.setTaxRate(0.10);
    summary = store.views.summary();
    expect(summary.tax).toBe('2.25');
    expect(summary.total).toBe('24.74');
  });
});