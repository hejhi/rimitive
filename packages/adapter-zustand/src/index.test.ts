import { describe, it, expect, vi } from 'vitest';
import type { RuntimeSliceFactory } from '@lattice/core';
import { compose } from '@lattice/core';
import { createStore } from '.';

describe('Zustand Adapter - New Architecture', () => {
  it('should demonstrate basic store creation and slice patterns', () => {
    // Define a simple counter component using the new API
    const createComponent = (
      createSlice: RuntimeSliceFactory<{ count: number }>
    ) => {
      // Step 2: Create slices - focused interfaces to the store
      // Actions slice - methods that mutate state
      const actions = createSlice(({ get, set }) => ({
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => set({ count: 0 }),
        setCount: (value: number) => set({ count: value }),
      }));

      // Query slice - methods that read state
      const queries = createSlice(({ get }) => ({
        count: () => get().count,
        isPositive: () => get().count > 0,
        isNegative: () => get().count < 0,
        isZero: () => get().count === 0,
      }));

      // Step 3: Create view slices that compute values
      const views = createSlice(({ get }) => ({
        // Direct computed values as methods
        computed: () => ({
          value: get().count,
          label: `Count: ${get().count}`,
          sign:
            get().count > 0
              ? 'positive'
              : get().count < 0
                ? 'negative'
                : 'zero',
        }),
        // Parameterized view
        display: (format: 'short' | 'long') => {
          const count = get().count;
          return format === 'short'
            ? `${count}`
            : `The current count is ${count} (${count > 0 ? 'positive' : count < 0 ? 'negative' : 'zero'})`;
        },
      }));

      return {
        actions,
        queries,
        views,
      };
    };

    // Create the store using the new API
    const createSlice = createStore({ count: 0 });
    const store = createComponent(createSlice);

    // Test initial state through queries
    expect(store.queries.selector.count()).toBe(0);
    expect(store.queries.selector.isZero()).toBe(true);
    expect(store.queries.selector.isPositive()).toBe(false);
    expect(store.queries.selector.isNegative()).toBe(false);

    // Test computed values (they're methods that return fresh data)
    const computed = store.views.selector.computed();
    expect(computed.value).toBe(0);
    expect(computed.label).toBe('Count: 0');
    expect(computed.sign).toBe('zero');

    // Test parameterized views
    expect(store.views.selector.display('short')).toBe('0');
    expect(store.views.selector.display('long')).toBe(
      'The current count is 0 (zero)'
    );

    // Test actions
    store.actions.selector.increment();
    expect(store.queries.selector.count()).toBe(1);

    // Get fresh computed values
    const updated = store.views.selector.computed();
    expect(updated.value).toBe(1);
    expect(updated.sign).toBe('positive');
    expect(store.views.selector.display('short')).toBe('1');

    // Test multiple operations
    store.actions.selector.increment();
    store.actions.selector.increment();
    expect(store.queries.selector.count()).toBe(3);

    store.actions.selector.decrement();
    expect(store.queries.selector.count()).toBe(2);

    store.actions.selector.reset();
    expect(store.queries.selector.count()).toBe(0);
    expect(store.queries.selector.isZero()).toBe(true);

    store.actions.selector.setCount(-5);
    expect(store.queries.selector.count()).toBe(-5);
    expect(store.queries.selector.isNegative()).toBe(true);
    expect(store.views.selector.computed().sign).toBe('negative');
  });

  it('should demonstrate slice composition with compose', () => {
    const createComponent = (
      createSlice: RuntimeSliceFactory<{
        todos: { id: string; text: string; done: boolean }[];
        filter: 'all' | 'active' | 'completed';
      }>
    ) => {
      // Base slices
      const todoQueries = createSlice(({ get }) => ({
        allTodos: () => get().todos,
        activeTodos: () => get().todos.filter((t) => !t.done),
        completedTodos: () => get().todos.filter((t) => t.done),
        getTodo: (id: string) => get().todos.find((t) => t.id === id),
      }));

      const filterQueries = createSlice(({ get }) => ({
        currentFilter: () => get().filter,
        isShowingAll: () => get().filter === 'all',
        isShowingActive: () => get().filter === 'active',
        isShowingCompleted: () => get().filter === 'completed',
      }));

      // Compose slices together for complex operations
      const todoActions = createSlice(
        compose(
          { todos: todoQueries, filter: filterQueries },
          ({ get, set }, { todos }) => ({
            addTodo: (text: string) => {
              const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const newTodo = { id, text, done: false };
              set({ todos: [...todos.allTodos(), newTodo] });
            },
            toggleTodo: (id: string) => {
              const todo = todos.getTodo(id);
              if (todo) {
                set({
                  todos: get().todos.map((t) =>
                    t.id === id ? { ...t, done: !t.done } : t
                  ),
                });
              }
            },
            removeTodo: (id: string) => {
              set({ todos: todos.allTodos().filter((t) => t.id !== id) });
            },
            clearCompleted: () => {
              set({ todos: todos.activeTodos() });
            },
          })
        )
      );

      const filterActions = createSlice(({ set }) => ({
        setFilter: (filter: 'all' | 'active' | 'completed') => set({ filter }),
      }));

      // Create view slice that computes values
      const views = createSlice(({ get }) => ({
        filteredTodos: () => {
          const filter = get().filter;
          const todos = get().todos;
          return filter === 'all'
            ? todos
            : filter === 'active'
              ? todos.filter((t) => !t.done)
              : todos.filter((t) => t.done);
        },
        stats: () => {
          const todos = get().todos;
          const active = todos.filter((t) => !t.done);
          const completed = todos.filter((t) => t.done);
          return {
            total: todos.length,
            active: active.length,
            completed: completed.length,
          };
        },
        summary: () => {
          const todos = get().todos;
          const active = todos.filter((t) => !t.done).length;
          const completed = todos.filter((t) => t.done).length;
          return `${active} active, ${completed} completed`;
        },
      }));

      return {
        todoActions,
        filterActions,
        todoQueries,
        filterQueries,
        views,
      };
    };

    const createSlice = createStore<{
      todos: { id: string; text: string; done: boolean }[];
      filter: 'all' | 'active' | 'completed';
    }>({
      todos: [],
      filter: 'all',
    });
    const store = createComponent(createSlice);

    // Test initial state
    expect(store.views.selector.filteredTodos()).toEqual([]);
    expect(store.views.selector.stats().total).toBe(0);

    // Add todos
    store.todoActions.selector.addTodo('Learn Lattice');
    store.todoActions.selector.addTodo('Build a component');

    expect(store.views.selector.stats().total).toBe(2);
    expect(store.views.selector.stats().active).toBe(2);
    expect(store.views.selector.stats().completed).toBe(0);
    expect(store.views.selector.summary()).toBe('2 active, 0 completed');

    // Toggle a todo
    const todos = store.todoQueries.selector.allTodos();
    store.todoActions.selector.toggleTodo(todos[0]!.id);

    // Check the state after toggle
    const stats = store.views.selector.stats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.completed).toBe(1);

    // Test filtering
    store.filterActions.selector.setFilter('active');
    const activeItems = store.views.selector.filteredTodos();
    expect(activeItems.length).toBe(1);
    expect(activeItems[0]?.text).toBe('Build a component');

    store.filterActions.selector.setFilter('completed');
    const completedItems = store.views.selector.filteredTodos();
    expect(completedItems.length).toBe(1);
    expect(completedItems[0]?.text).toBe('Learn Lattice');

    // Clear completed
    store.todoActions.selector.clearCompleted();
    expect(store.views.selector.stats().total).toBe(1);
    expect(store.views.selector.stats().completed).toBe(0);
  });

  it('should support subscriptions and demonstrate reactivity', () => {
    const createComponent = (
      createSlice: RuntimeSliceFactory<{ value: number; history: number[] }>
    ) => {
      const actions = createSlice(({ get, set }) => ({
        setValue: (value: number) => {
          const current = get();
          set({
            value,
            history: [...current.history, value],
          });
        },
        increment: () => {
          const current = get();
          const newValue = current.value + 1;
          set({
            value: newValue,
            history: [...current.history, newValue],
          });
        },
        reset: () => set({ value: 0, history: [] }),
      }));

      const queries = createSlice(({ get }) => ({
        current: () => get().value,
        history: () => get().history,
        hasHistory: () => get().history.length > 0,
        lastValue: () => {
          const hist = get().history;
          return hist.length > 1 ? hist[hist.length - 2] : null;
        },
      }));

      return { actions, queries };
    };

    const createSlice = createStore({ value: 0, history: [] as number[] });
    const store = createComponent(createSlice);

    // Track subscription calls
    const listener = vi.fn();
    const unsubscribe = store.actions.subscribe(listener);

    // Initial state
    expect(store.queries.selector.current()).toBe(0);
    expect(store.queries.selector.hasHistory()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    // Update state
    store.actions.selector.setValue(42);
    expect(store.queries.selector.current()).toBe(42);
    expect(store.queries.selector.history()).toEqual([42]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Another update
    store.actions.selector.increment();
    expect(store.queries.selector.current()).toBe(43);
    expect(store.queries.selector.history()).toEqual([42, 43]);
    expect(store.queries.selector.lastValue()).toBe(42);
    expect(listener).toHaveBeenCalledTimes(2);

    // Multiple listeners
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    const unsub2 = store.actions.subscribe(listener2);
    const unsub3 = store.actions.subscribe(listener3);

    store.actions.selector.setValue(100);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    // Unsubscribe first listener
    unsubscribe();
    store.actions.selector.reset();
    expect(listener).toHaveBeenCalledTimes(3); // No more calls
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);

    // Cleanup
    unsub2();
    unsub3();
  });

  it('should demonstrate parameterized selectors and mixed patterns', () => {
    const createComponent = (
      createSlice: RuntimeSliceFactory<{
        products: {
          id: string;
          name: string;
          price: number;
          category: string;
        }[];
        taxRate: number;
        discount: number;
      }>
    ) => {
      // Product queries
      const products = createSlice(({ get }) => ({
        all: () => get().products,
        byId: (id: string) => get().products.find((p) => p.id === id),
        byCategory: (category: string) =>
          get().products.filter((p) => p.category === category),
      }));

      // Pricing calculations
      const pricing = createSlice(({ get }) => ({
        taxRate: () => get().taxRate,
        discount: () => get().discount,
        calculatePrice: (basePrice: number) => {
          const discounted = basePrice * (1 - get().discount);
          return discounted * (1 + get().taxRate);
        },
      }));

      // Create catalog views
      const catalog = createSlice(({ get }) => ({
        // Direct computed values
        totalProducts: () => get().products.length,
        categories: () => [...new Set(get().products.map((p) => p.category))],

        // Parameterized selector for product details
        getProductDetails: (id: string) => {
          const product = get().products.find((p) => p.id === id);
          if (!product) return null;

          const discount = get().discount;
          const taxRate = get().taxRate;
          const discountedPrice = product.price * (1 - discount);
          const finalPrice = discountedPrice * (1 + taxRate);

          return {
            ...product,
            finalPrice,
            savings: product.price * discount,
            tax: discountedPrice * taxRate,
          };
        },

        // Category summary factory
        getCategorySummary: (category: string) => {
          const items = get().products.filter((p) => p.category === category);
          const discount = get().discount;
          const taxRate = get().taxRate;

          const totalBase = items.reduce((sum, p) => sum + p.price, 0);
          const totalFinal = items.reduce((sum, p) => {
            const discounted = p.price * (1 - discount);
            return sum + discounted * (1 + taxRate);
          }, 0);

          return {
            category,
            itemCount: items.length,
            totalBasePrice: totalBase,
            totalFinalPrice: totalFinal,
            totalSavings: totalBase - totalFinal / (1 + taxRate),
          };
        },
      }));

      return { products, pricing, catalog };
    };

    const createSlice = createStore({
      products: [
        { id: '1', name: 'Laptop', price: 999, category: 'electronics' },
        { id: '2', name: 'Mouse', price: 29, category: 'electronics' },
        { id: '3', name: 'Desk', price: 299, category: 'furniture' },
        { id: '4', name: 'Chair', price: 199, category: 'furniture' },
      ],
      taxRate: 0.08,
      discount: 0.1,
    });
    const store = createComponent(createSlice);

    // Test direct computed values
    expect(store.catalog.selector.totalProducts()).toBe(4);
    expect(store.catalog.selector.categories()).toEqual([
      'electronics',
      'furniture',
    ]);

    // Test parameterized product details
    const laptop = store.catalog.selector.getProductDetails('1');
    expect(laptop).not.toBeNull();
    expect(laptop!.name).toBe('Laptop');
    expect(laptop!.price).toBe(999);
    expect(laptop!.finalPrice).toBeCloseTo(971.03, 2); // (999 * 0.9) * 1.08
    expect(laptop!.savings).toBeCloseTo(99.9, 2);
    expect(laptop!.tax).toBeCloseTo(71.93, 2);

    // Test category summaries
    const electronics =
      store.catalog.selector.getCategorySummary('electronics');
    expect(electronics.itemCount).toBe(2);
    expect(electronics.category).toBe('electronics');
    expect(electronics.totalBasePrice).toBe(1028);

    const furniture = store.catalog.selector.getCategorySummary('furniture');
    expect(furniture.itemCount).toBe(2);
    expect(furniture.totalBasePrice).toBe(498);
  });

  it('should work with createZustandAdapter convenience function', () => {
    // Define a component factory directly
    const counterComponent = (
      createSlice: RuntimeSliceFactory<{ count: number }>
    ) => {
      const api = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        double: () => set({ count: get().count * 2 }),
        reset: () => set({ count: 0 }),
      }));

      return api;
    };

    // Use the new API
    const createSlice = createStore({ count: 0 });
    const store = counterComponent(createSlice);

    // Test the API
    expect(store.selector.count()).toBe(0);

    store.selector.increment();
    expect(store.selector.count()).toBe(1);

    store.selector.double();
    expect(store.selector.count()).toBe(2);

    store.selector.double();
    expect(store.selector.count()).toBe(4);

    store.selector.decrement();
    expect(store.selector.count()).toBe(3);

    store.selector.reset();
    expect(store.selector.count()).toBe(0);

    // Test subscriptions work
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.selector.increment();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
  });
});
